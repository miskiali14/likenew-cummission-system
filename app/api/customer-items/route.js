import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { todayStr } from '@/lib/date';

// Customer Items (belongings left behind, held until claimed) — Admin sees
// everything and can filter by branch. Every other user (Sales, Call
// Center, ...) only ever sees the items they personally logged — not a
// colleague's, even at the same branch — so two people sharing this desk
// each get their own private list. Legacy items logged before this
// tracking existed (createdById is null) stay visible to everyone so
// nothing old disappears.
export async function GET(request) {
  const auth = requireAuth(request, ['ADMIN', 'SALES', 'CALL_CENTER']);
  if (auth.response) return auth.response;
  const user = auth.user;

  try {
    const { searchParams } = new URL(request.url);
    const branchParam = searchParams.get('branch');
    const status = searchParams.get('status');

    const whereClause = {};
    if (user.role === 'ADMIN') {
      if (branchParam && branchParam !== 'All') whereClause.branch = branchParam;
    } else {
      whereClause.OR = [{ createdById: user.id }, { createdById: null }];
    }
    if (status && status !== 'All') whereClause.status = status;

    const items = await prisma.customerItem.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(items);
  } catch (error) {
    return NextResponse.json({ message: 'A server error occurred', error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = requireAuth(request, ['ADMIN', 'SALES', 'CALL_CENTER']);
  if (auth.response) return auth.response;
  const user = auth.user;

  try {
    const body = await request.json();
    const { customerId, customerName, phone, description, date } = body;

    if (!customerId || !customerName || !description) {
      return NextResponse.json(
        { message: 'Please fill in customer ID, customer name, and item description' },
        { status: 400 }
      );
    }

    const branch = ['ADMIN', 'CALL_CENTER'].includes(user.role)
      ? (body.branch || user.branch || 'HQ')
      : user.branch;

    const item = await prisma.customerItem.create({
      data: {
        branch,
        customerId: String(customerId),
        customerName,
        phone: phone || null,
        description,
        date: date || todayStr(),
        createdById: user.id,
        createdByName: user.fullName,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to save item', error: error.message }, { status: 500 });
  }
}
