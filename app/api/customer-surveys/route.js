import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { todayStr } from '@/lib/date';

// Loyalty check-in calls — Admin, Customer Care, and Customer Ops are the
// roles who'd realistically be placing these calls.
const CAN_ACCESS = ['ADMIN', 'CUSTOMER_CARE', 'CUSTOMER_OPS'];
const SEES_ALL_BRANCHES = CAN_ACCESS;

export async function GET(request) {
  const auth = requireAuth(request, CAN_ACCESS);
  if (auth.response) return auth.response;
  const user = auth.user;

  try {
    const { searchParams } = new URL(request.url);
    const branchParam = searchParams.get('branch');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const whereClause = {};
    if (SEES_ALL_BRANCHES.includes(user.role)) {
      if (branchParam && branchParam !== 'All') whereClause.branch = branchParam;
    } else {
      whereClause.branch = user.branch;
    }
    if (dateFrom || dateTo) {
      whereClause.date = {};
      if (dateFrom) whereClause.date.gte = dateFrom;
      if (dateTo) whereClause.date.lte = dateTo;
    }

    const items = await prisma.customerCallSurvey.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(items);
  } catch (error) {
    return NextResponse.json({ message: 'A server error occurred', error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = requireAuth(request, CAN_ACCESS);
  if (auth.response) return auth.response;
  const user = auth.user;

  try {
    const body = await request.json();
    const {
      customerName, phone, date,
      hasComplaint, complaintNotes, tourGiven, packageGiven,
      satisfaction, qualityRating, desiredService, suggestedChanges,
    } = body;

    if (!customerName || !phone) {
      return NextResponse.json({ message: 'Please fill in the customer name and phone' }, { status: 400 });
    }
    if (hasComplaint && !(complaintNotes && complaintNotes.trim())) {
      return NextResponse.json({ message: 'Please describe the complaint' }, { status: 400 });
    }

    const branch = SEES_ALL_BRANCHES.includes(user.role)
      ? (body.branch || user.branch || 'HQ')
      : user.branch;

    const item = await prisma.customerCallSurvey.create({
      data: {
        branch,
        customerName,
        phone,
        date: date || todayStr(),
        hasComplaint: Boolean(hasComplaint),
        complaintNotes: hasComplaint ? complaintNotes.trim() : null,
        tourGiven: Boolean(tourGiven),
        packageGiven: Boolean(packageGiven),
        satisfaction: satisfaction || null,
        qualityRating: qualityRating || null,
        desiredService: desiredService || null,
        suggestedChanges: suggestedChanges || null,
        createdById: user.id,
        createdByName: user.fullName,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to save survey', error: error.message }, { status: 500 });
  }
}
