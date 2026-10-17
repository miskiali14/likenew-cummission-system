import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// New Dead Stock report — Admin, Customer Care, and Customer Ops only (the
// roles that manage/resolve entries). Sales and Call Center can log entries
// but don't get the analytics view, same split as Complaints Report.
export async function GET(request) {
  const auth = requireAuth(request, ['ADMIN', 'CUSTOMER_CARE', 'CUSTOMER_OPS']);
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const branchParam = searchParams.get('branch');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const whereClause = {};
    if (branchParam && branchParam !== 'All') whereClause.branch = branchParam;
    if (dateFrom || dateTo) {
      whereClause.date = {};
      if (dateFrom) whereClause.date.gte = dateFrom;
      if (dateTo) whereClause.date.lte = dateTo;
    }

    const items = await prisma.newDeadStock.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(items);
  } catch (error) {
    return NextResponse.json({ message: 'A server error occurred', error: error.message }, { status: 500 });
  }
}
