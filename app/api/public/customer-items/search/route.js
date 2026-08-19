import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Public, unauthenticated lookup for customers to check on items they left
// behind — by their own name, ticket/customer ID, or phone number. A search
// term is required so this can't be used to dump the whole table.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();

    if (q.length < 3) {
      return NextResponse.json(
        { message: 'Please enter at least 3 characters to search' },
        { status: 400 }
      );
    }

    const items = await prisma.customerItem.findMany({
      where: {
        OR: [
          { customerId: { contains: q, mode: 'insensitive' } },
          { customerName: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        branch: true,
        customerId: true,
        customerName: true,
        description: true,
        date: true,
        status: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json(items);
  } catch (error) {
    return NextResponse.json({ message: 'A server error occurred', error: error.message }, { status: 500 });
  }
}
