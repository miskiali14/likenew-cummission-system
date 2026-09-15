import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { CUSTOMER_ITEM_CLAIM_COMMISSION } from '@/lib/commission';

// Customer Item claim commission — a separate report from washing/ironing
// commission. Call Center only ever sees their own total; Admin sees a
// per-person breakdown plus the grand total.
export async function GET(request) {
  const auth = requireAuth(request, ['ADMIN', 'CALL_CENTER']);
  if (auth.response) return auth.response;
  const user = auth.user;

  try {
    const whereClause = { status: 'CLAIMED', claimedById: { not: null } };
    if (user.role !== 'ADMIN') {
      whereClause.claimedById = user.id;
    }

    const claimed = await prisma.customerItem.findMany({
      where: whereClause,
      select: { claimedById: true, claimedByName: true },
    });

    if (user.role !== 'ADMIN') {
      const count = claimed.length;
      return NextResponse.json({
        myClaimedCount: count,
        myCommission: Number((count * CUSTOMER_ITEM_CLAIM_COMMISSION).toFixed(2)),
      });
    }

    const byUser = new Map();
    for (const c of claimed) {
      const key = c.claimedById;
      const entry = byUser.get(key) || { userId: key, name: c.claimedByName || 'Unknown', count: 0 };
      entry.count += 1;
      byUser.set(key, entry);
    }
    const breakdown = [...byUser.values()]
      .map((e) => ({ ...e, commission: Number((e.count * CUSTOMER_ITEM_CLAIM_COMMISSION).toFixed(2)) }))
      .sort((a, b) => b.commission - a.commission);

    const totalCount = claimed.length;
    return NextResponse.json({
      totalClaimedCount: totalCount,
      totalCommission: Number((totalCount * CUSTOMER_ITEM_CLAIM_COMMISSION).toFixed(2)),
      byUser: breakdown,
    });
  } catch (error) {
    return NextResponse.json({ message: 'A server error occurred', error: error.message }, { status: 500 });
  }
}
