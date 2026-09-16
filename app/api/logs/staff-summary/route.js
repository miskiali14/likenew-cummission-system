import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { resolveBranch } from '@/lib/branch';
import { todayStr } from '@/lib/date';
import { calculateOrderCommission } from '@/lib/commission';
import { getCommissionCountedIds } from '@/lib/duplicates';

// Staff Summary Controller — Admin, Sales, QC, Viewer. Sales/QC can only ever
// see today's report. Viewer and Admin can both pick a single date or a date
// range (e.g. the 1st through the 20th of a month); Viewer defaults to today
// when no range is given.
export async function GET(request) {
  const auth = requireAuth(request, ['ADMIN', 'SALES', 'QUALITY_CONTROL', 'VIEWER']);
  if (auth.response) return auth.response;
  const user = auth.user;
  const canPickDate = user.role === 'ADMIN' || user.role === 'VIEWER';

  try {
    const { searchParams } = new URL(request.url);
    const branch = resolveBranch(user, searchParams);
    // A department-scoped Viewer is forced to their assigned department,
    // regardless of what the client requests.
    const department =
      user.role === 'VIEWER' && user.department ? user.department : searchParams.get('department');
    const date = canPickDate ? searchParams.get('date') : todayStr();
    const dateFrom = canPickDate ? searchParams.get('dateFrom') : null;
    const dateTo = canPickDate ? searchParams.get('dateTo') : null;

    const whereClause = {};
    if (branch) whereClause.branch = branch;
    if (department && department !== 'All') whereClause.department = department;
    if (dateFrom || dateTo) {
      whereClause.date = {};
      if (dateFrom) whereClause.date.gte = dateFrom;
      if (dateTo) whereClause.date.lte = dateTo;
    } else if (date) {
      whereClause.date = date;
    } else if (user.role === 'VIEWER') {
      whereClause.date = todayStr();
    }

    const logs = await prisma.log.findMany({
      where: whereClause,
      select: {
        id: true,
        orderId: true,
        staffName: true,
        employeeId: true,
        employee: { select: { name: true } },
        department: true,
        branch: true,
        quantity: true,
        durationMinutes: true,
        createdAt: true,
      },
    });

    // Duplicate orders (same orderId/department/branch, logged more than
    // once) only earn commission once — on whichever entry was registered
    // first. The later duplicate(s) still count toward items/orders totals,
    // just not commission.
    const commissionCountedIds = getCommissionCountedIds(logs);

    // Group by the linked Employee (the source of truth for their name),
    // not the free-text staffName snapshot on each log — that snapshot can
    // drift over time (typos, spelling variants like "Sakariye Cabdiqaadir"
    // vs "Sakarie Abdikadir" for the same person), which used to split one
    // real employee across multiple rows. Logs from before Employee-linking
    // existed (no employeeId) still fall back to a normalized staffName key.
    const mergedByKey = new Map();
    for (const log of logs) {
      const canonicalName = log.employee?.name || log.staffName.trim();
      const key = log.employeeId
        ? `emp:${log.employeeId}`
        : `name:${log.staffName.trim().toLowerCase()}|${log.department}|${log.branch}`;

      if (!mergedByKey.has(key)) {
        mergedByKey.set(key, {
          staffName: canonicalName,
          department: log.department,
          branch: log.branch,
          totalQuantity: 0,
          totalDuration: 0,
          totalOrdersHandled: 0,
          commissionEarned: 0,
        });
      }

      const row = mergedByKey.get(key);
      row.totalQuantity += log.quantity || 0;
      row.totalDuration += log.durationMinutes || 0;
      row.totalOrdersHandled += 1;
      // Commission is tiered per-order (flat rate per order, not per piece);
      // each order's own quantity picks its tier, and the tier rate depends
      // on the department (Ironing vs Washing). Duplicate orders only pay
      // commission once (see commissionCountedIds above).
      if (commissionCountedIds.has(log.id)) {
        row.commissionEarned += calculateOrderCommission(log.quantity, log.department);
      }
    }

    const formattedSummary = Array.from(mergedByKey.values())
      .map((row) => ({
        staffName: row.staffName,
        department: row.department,
        branch: row.branch,
        totalQuantity: row.totalQuantity,
        totalDuration: row.totalDuration,
        totalOrdersHandled: row.totalOrdersHandled,
        commissionEarned: row.commissionEarned,
      }))
      .sort((a, b) => b.totalQuantity - a.totalQuantity);

    return NextResponse.json(formattedSummary);
  } catch (error) {
    return NextResponse.json({ message: 'A server error occurred', error: error.message }, { status: 500 });
  }
}
