import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { resolveBranch } from '@/lib/branch';
import { todayStr } from '@/lib/date';

// Ironing Logs — QC & Admin. QC only ever sees today's orders; Admin sees
// full history (they have "All Registered Logs" for that).
export async function GET(request) {
  const auth = requireAuth(request, ['ADMIN', 'QUALITY_CONTROL']);
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const branch = resolveBranch(auth.user, searchParams);
    const whereClause = { department: 'IRONING' };
    if (branch) whereClause.branch = branch;
    if (auth.user.role !== 'ADMIN') whereClause.date = todayStr();

    const logs = await prisma.log.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(logs);
  } catch (error) {
    return NextResponse.json({ message: 'A server error occurred', error: error.message }, { status: 500 });
  }
}
