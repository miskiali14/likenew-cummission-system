import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { todayStr } from '@/lib/date';

// "New Dead Stock" — a second, parallel list to the original Dead Stock
// (kept separate and unchanged). Admin, Customer Care, Customer Ops, Sales,
// and Call Center all have full access — every branch, log, resolve, edit,
// delete.
const CAN_LOG = ['ADMIN', 'CUSTOMER_CARE', 'CUSTOMER_OPS', 'SALES', 'CALL_CENTER'];
const SEES_ALL_BRANCHES = CAN_LOG;

export async function GET(request) {
  const auth = requireAuth(request, CAN_LOG);
  if (auth.response) return auth.response;
  const user = auth.user;

  try {
    const { searchParams } = new URL(request.url);
    const branchParam = searchParams.get('branch');
    const status = searchParams.get('status');

    const whereClause = {};
    if (SEES_ALL_BRANCHES.includes(user.role)) {
      if (branchParam && branchParam !== 'All') whereClause.branch = branchParam;
    } else {
      whereClause.branch = user.branch;
    }
    if (status && status !== 'All') whereClause.status = status;

    const items = await prisma.newDeadStock.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(items);
  } catch (error) {
    return NextResponse.json({ message: 'A server error occurred', error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = requireAuth(request, CAN_LOG);
  if (auth.response) return auth.response;
  const user = auth.user;

  try {
    const body = await request.json();
    const { customerName, customerId, phone, orderId, category, quantity, date, loggedByName } = body;

    if (!customerName || !customerId || !phone || !orderId || !category || !String(category).trim()) {
      return NextResponse.json(
        { message: 'Please fill in the customer name, ID, phone, order reference, and category' },
        { status: 400 }
      );
    }
    // The account itself is often a shared branch login (e.g. "Sales HQ"),
    // not one person — the real logger is picked from the staff dropdown.
    if (!loggedByName || !String(loggedByName).trim()) {
      return NextResponse.json({ message: 'Please select who is logging this entry' }, { status: 400 });
    }

    const branch = SEES_ALL_BRANCHES.includes(user.role)
      ? (body.branch || user.branch || 'HQ')
      : user.branch;

    const item = await prisma.newDeadStock.create({
      data: {
        branch,
        customerName,
        customerId: String(customerId),
        phone,
        orderId: String(orderId),
        category,
        quantity: Number(quantity) > 0 ? Number(quantity) : 1,
        date: date || todayStr(),
        createdById: user.id,
        createdByName: loggedByName.trim(),
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to save entry', error: error.message }, { status: 500 });
  }
}
