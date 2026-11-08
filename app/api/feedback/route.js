import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// Read-only — rows are only ever created by the public WhatsApp bot intake
// (/api/public/feedback), never from the dashboard itself.
const CAN_ACCESS = ['ADMIN', 'CUSTOMER_CARE', 'CUSTOMER_OPS'];

export async function GET(request) {
  const auth = requireAuth(request, CAN_ACCESS);
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const branchParam = searchParams.get('branch');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const whereClause = {};
    if (branchParam && branchParam !== 'All') whereClause.branch = branchParam;
    if (dateFrom || dateTo) {
      whereClause.createdAt = {};
      if (dateFrom) whereClause.createdAt.gte = new Date(`${dateFrom}T00:00:00.000Z`);
      if (dateTo) whereClause.createdAt.lte = new Date(`${dateTo}T23:59:59.999Z`);
    }

    const feedback = await prisma.feedback.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(feedback);
  } catch (error) {
    return NextResponse.json({ message: 'A server error occurred', error: error.message }, { status: 500 });
  }
}
