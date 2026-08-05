import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { resolveBranch } from '@/lib/branch';

// Ironing Logs — QC & Admin
export async function GET(request) {
  const auth = requireAuth(request, ['ADMIN', 'QUALITY_CONTROL']);
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const branch = resolveBranch(auth.user, searchParams);
    const whereClause = { department: 'IRONING' };
    if (branch) whereClause.branch = branch;

    const logs = await prisma.log.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(logs);
  } catch (error) {
    return NextResponse.json({ message: 'A server error occurred', error: error.message }, { status: 500 });
  }
}
