import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { todayStr } from '@/lib/date';

// Customer complaints — Admin and Customer Care see every branch; Sales
// and Call Center see and register complaints for their own branch only
// (Call Center can view/add but not edit, resolve, or delete — see [id]).
export async function GET(request) {
  const auth = requireAuth(request, ['ADMIN', 'SALES', 'CUSTOMER_CARE', 'CALL_CENTER']);
  if (auth.response) return auth.response;
  const user = auth.user;

  try {
    const { searchParams } = new URL(request.url);
    const branchParam = searchParams.get('branch');
    const status = searchParams.get('status');

    const branch = ['ADMIN', 'CUSTOMER_CARE'].includes(user.role)
      ? (branchParam && branchParam !== 'All' ? branchParam : null)
      : user.branch;

    const whereClause = {};
    if (branch) whereClause.branch = branch;
    if (status && status !== 'All') whereClause.status = status;

    const complaints = await prisma.complaint.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(complaints);
  } catch (error) {
    return NextResponse.json({ message: 'A server error occurred', error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = requireAuth(request, ['ADMIN', 'SALES', 'CUSTOMER_CARE', 'CALL_CENTER']);
  if (auth.response) return auth.response;
  const user = auth.user;

  try {
    const body = await request.json();
    const { customerName, phone, orderId, category, description, date } = body;

    if (!customerName || !description) {
      return NextResponse.json(
        { message: 'Please fill in the customer name and complaint details' },
        { status: 400 }
      );
    }

    const branch = ['ADMIN', 'CUSTOMER_CARE'].includes(user.role)
      ? (body.branch || user.branch || 'HQ')
      : user.branch;

    const complaint = await prisma.complaint.create({
      data: {
        branch,
        customerName,
        phone: phone || null,
        orderId: orderId || null,
        category: category || 'OTHER',
        description,
        date: date || todayStr(),
      },
    });

    return NextResponse.json(complaint, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to save complaint', error: error.message }, { status: 500 });
  }
}
