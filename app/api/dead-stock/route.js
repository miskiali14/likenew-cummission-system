import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { todayStr } from '@/lib/date';

const VALID_CATEGORIES = ['LALAAB', 'HANGER', 'BUSTE_ROOG', 'KABO'];

// Dead Stock — old, uncollected orders sitting at a branch. Admin and
// Customer Care only; both see every branch.
export async function GET(request) {
  const auth = requireAuth(request, ['ADMIN', 'CUSTOMER_CARE']);
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const branchParam = searchParams.get('branch');
    const status = searchParams.get('status');

    const whereClause = {};
    if (branchParam && branchParam !== 'All') whereClause.branch = branchParam;
    if (status && status !== 'All') whereClause.status = status;

    const items = await prisma.deadStock.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(items);
  } catch (error) {
    return NextResponse.json({ message: 'A server error occurred', error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = requireAuth(request, ['ADMIN', 'CUSTOMER_CARE']);
  if (auth.response) return auth.response;
  const user = auth.user;

  try {
    const body = await request.json();
    const { orderId, category, quantity, date, branch } = body;

    if (!orderId || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { message: 'Please fill in the order reference and select a category' },
        { status: 400 }
      );
    }

    const item = await prisma.deadStock.create({
      data: {
        branch: branch || user.branch || 'HQ',
        orderId: String(orderId),
        category,
        quantity: Number(quantity) > 0 ? Number(quantity) : 1,
        date: date || todayStr(),
        createdById: user.id,
        createdByName: user.fullName,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to save dead stock entry', error: error.message }, { status: 500 });
  }
}
