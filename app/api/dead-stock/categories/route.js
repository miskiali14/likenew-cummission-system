import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// Dead Stock category options — a user-managed list (not a fixed enum),
// shared by both the original Dead Stock and New Dead Stock. Everyone who
// can log either one needs to read this list; only the roles that can
// manage dead stock can add a new category.
export async function GET(request) {
  const auth = requireAuth(request, ['ADMIN', 'CUSTOMER_CARE', 'CUSTOMER_OPS', 'SALES', 'CALL_CENTER']);
  if (auth.response) return auth.response;

  try {
    const categories = await prisma.deadStockCategoryOption.findMany({
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(categories);
  } catch (error) {
    return NextResponse.json({ message: 'A server error occurred', error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = requireAuth(request, ['ADMIN', 'CUSTOMER_CARE', 'CUSTOMER_OPS']);
  if (auth.response) return auth.response;

  try {
    const body = await request.json();
    const name = (body.name || '').trim();

    if (!name) {
      return NextResponse.json({ message: 'Please enter a category name' }, { status: 400 });
    }

    const existing = await prisma.deadStockCategoryOption.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json({ message: 'This category already exists' }, { status: 400 });
    }

    const category = await prisma.deadStockCategoryOption.create({ data: { name } });
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to save category', error: error.message }, { status: 500 });
  }
}
