import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { resolveBranch } from '@/lib/branch';
import { todayStr } from '@/lib/date';

// Ironing Logs — QC, Viewer & Admin. QC only ever sees today's orders.
// Viewer can pick a date range (defaults to today); Admin sees full history
// here too (they also have "All Registered Logs" for that).
export async function GET(request) {
  const auth = requireAuth(request, ['ADMIN', 'QUALITY_CONTROL', 'VIEWER']);
  if (auth.response) return auth.response;

  try {
    if (auth.user.role === 'VIEWER' && auth.user.department && auth.user.department !== 'IRONING') {
      return NextResponse.json(
        { message: 'You do not have permission to view this department' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const branch = resolveBranch(auth.user, searchParams);
    const whereClause = { department: 'IRONING' };
    if (branch) whereClause.branch = branch;

    if (auth.user.role === 'QUALITY_CONTROL') {
      whereClause.date = todayStr();
    } else if (auth.user.role === 'VIEWER' || auth.user.role === 'ADMIN') {
      const dateFrom = searchParams.get('dateFrom');
      const dateTo = searchParams.get('dateTo');
      if (dateFrom || dateTo) {
        whereClause.date = {};
        if (dateFrom) whereClause.date.gte = dateFrom;
        if (dateTo) whereClause.date.lte = dateTo;
      } else if (auth.user.role === 'VIEWER') {
        whereClause.date = todayStr();
      }
    }

    const logs = await prisma.log.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(logs);
  } catch (error) {
    return NextResponse.json({ message: 'A server error occurred', error: error.message }, { status: 500 });
  }
}
