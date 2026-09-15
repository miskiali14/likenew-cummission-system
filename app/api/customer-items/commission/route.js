import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { CUSTOMER_ITEM_CLAIM_COMMISSION } from '@/lib/commission';

// Customer Item claim commission — a separate report from washing/ironing
// commission, never mixed into it. Call Center only ever sees their own
// total and history; Admin sees a per-person breakdown, the grand total,
// and every claimed item. Optional dateFrom/dateTo (YYYY-MM-DD) filter by
// when the item was actually claimed.
export async function GET(request) {
  const auth = requireAuth(request, ['ADMIN', 'CALL_CENTER']);
  if (auth.response) return auth.response;
  const user = auth.user;

  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const whereClause = { status: 'CLAIMED', claimedById: { not: null } };
    if (user.role !== 'ADMIN') {
      whereClause.claimedById = user.id;
    }
    if (dateFrom || dateTo) {
      whereClause.claimedAt = {};
      if (dateFrom) whereClause.claimedAt.gte = new Date(`${dateFrom}T00:00:00.000Z`);
      if (dateTo) whereClause.claimedAt.lte = new Date(`${dateTo}T23:59:59.999Z`);
    }

    const claimed = await prisma.customerItem.findMany({
      where: whereClause,
      orderBy: { claimedAt: 'desc' },
      select: {
        id: true,
        branch: true,
        customerId: true,
        customerName: true,
        description: true,
        date: true,
        claimedAt: true,
        claimedById: true,
        claimedByName: true,
        collectionMethod: true,
        collectionNotes: true,
      },
    });

    const items = claimed.map((c) => ({ ...c, commission: CUSTOMER_ITEM_CLAIM_COMMISSION }));

    if (user.role !== 'ADMIN') {
      const count = claimed.length;
      return NextResponse.json({
        myClaimedCount: count,
        myCommission: Number((count * CUSTOMER_ITEM_CLAIM_COMMISSION).toFixed(2)),
        items,
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
      items,
    });
  } catch (error) {
    return NextResponse.json({ message: 'A server error occurred', error: error.message }, { status: 500 });
  }
}
