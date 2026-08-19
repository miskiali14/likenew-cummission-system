import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { todayStr } from '@/lib/date';

// Customer Items (belongings left behind, held until claimed) — Admin sees
// every branch; Sales sees and registers items for their own branch only.
export async function GET(request) {
  const auth = requireAuth(request, ['ADMIN', 'SALES']);
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
  const auth = requireAuth(request, ['ADMIN', 'SALES']);
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

    const branch = user.role === 'ADMIN' ? (body.branch || 'HQ') : user.branch;

    const item = await prisma.customerItem.create({
      data: {
        branch,
        customerId: String(customerId),
        customerName,
        phone: phone || null,
        description,
        date: date || todayStr(),
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to save item', error: error.message }, { status: 500 });
  }
}
