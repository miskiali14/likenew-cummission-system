import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { resolveBranch } from '@/lib/branch';

// Admin All Logs Controller (/api/logs/all) — ADMIN only
export async function GET(request) {
  const auth = requireAuth(request, ['ADMIN']);
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const branch = resolveBranch(auth.user, searchParams);
    const department = searchParams.get('department');
    const date = searchParams.get('date');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const employeeId = searchParams.get('employeeId');

    const whereClause = {};
    if (branch) whereClause.branch = branch;
    if (department && department !== 'All') whereClause.department = department;
    if (employeeId) whereClause.employeeId = employeeId;
    if (dateFrom || dateTo) {
      whereClause.date = {};
      if (dateFrom) whereClause.date.gte = dateFrom;
      if (dateTo) whereClause.date.lte = dateTo;
    } else if (date) {
      whereClause.date = date;
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
