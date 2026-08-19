import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Public, unauthenticated lookup for customers to check on items they left
// behind — by their own name, ticket/customer ID, or phone number. A search
// term is required so this can't be used to dump the whole table. CORS is
// open since the customer-facing lookup page lives on its own separate site.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();

    if (q.length < 3) {
      return NextResponse.json(
        { message: 'Please enter at least 3 characters to search' },
        { status: 400, headers: CORS_HEADERS }
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

    return NextResponse.json(items, { headers: CORS_HEADERS });
  } catch (error) {
    return NextResponse.json(
      { message: 'A server error occurred', error: error.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
