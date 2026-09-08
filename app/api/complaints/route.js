import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { todayStr } from '@/lib/date';

// Customer complaints — Admin sees every branch; Sales and Customer Care
// see and register complaints for their own branch.
export async function GET(request) {
  const auth = requireAuth(request, ['ADMIN', 'SALES', 'CUSTOMER_CARE']);
  if (auth.response) return auth.response;
  const user = auth.user;

  try {
    const { searchParams } = new URL(request.url);
    const branchParam = searchParams.get('branch');
    const status = searchParams.get('status');

    const branch = user.role === 'ADMIN'
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
  const auth = requireAuth(request, ['ADMIN', 'SALES', 'CUSTOMER_CARE']);
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

    const branch = user.role === 'ADMIN' ? (body.branch || 'HQ') : user.branch;

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
