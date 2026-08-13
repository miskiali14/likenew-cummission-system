import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { resolveBranch } from '@/lib/branch';
import { calculateOrderCommission } from '@/lib/commission';

// Admin Stats Controller (/api/logs/stats) — ADMIN only
export async function GET(request) {
  const auth = requireAuth(request, ['ADMIN']);
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const branch = resolveBranch(auth.user, searchParams);
    const whereClause = branch ? { branch } : {};

    const [washing, ironing, totalOrders, commissionLogs] = await Promise.all([
      prisma.log.count({ where: { ...whereClause, department: 'WASHING' } }),
      prisma.log.count({ where: { ...whereClause, department: 'IRONING' } }),
      prisma.log.count({ where: whereClause }),
      prisma.log.findMany({
        where: whereClause,
        select: { quantity: true, department: true },
      }),
    ]);

    // Commission is tiered per-order (flat rate per order, not per piece);
    // rate depends on the order's quantity tier and its department.
    const totalCommission = commissionLogs.reduce(
      (sum, log) => sum + calculateOrderCommission(log.quantity, log.department),
      0
    );

    return NextResponse.json({ washing, ironing, totalOrders, totalCommission });
  } catch (error) {
    return NextResponse.json({ message: 'A server error occurred', error: error.message }, { status: 500 });
  }
}
