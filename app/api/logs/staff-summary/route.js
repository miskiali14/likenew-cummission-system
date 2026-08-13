import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { resolveBranch } from '@/lib/branch';
import { todayStr } from '@/lib/date';
import { calculateOrderCommission } from '@/lib/commission';

// Staff Summary Controller — Admin, Sales, QC, Viewer. Sales/QC/Viewer can
// only ever see today's report; Admin can pick any date.
export async function GET(request) {
  const auth = requireAuth(request, ['ADMIN', 'SALES', 'QUALITY_CONTROL', 'VIEWER']);
  if (auth.response) return auth.response;
  const user = auth.user;

  try {
    const { searchParams } = new URL(request.url);
    const branch = resolveBranch(user, searchParams);
    // A department-scoped Viewer is forced to their assigned department,
    // regardless of what the client requests.
    const department =
      user.role === 'VIEWER' && user.department ? user.department : searchParams.get('department');
    const date = user.role === 'ADMIN' ? searchParams.get('date') : todayStr();

    const whereClause = {};
    if (branch) whereClause.branch = branch;
    if (department && department !== 'All') whereClause.department = department;
    if (date) whereClause.date = date;

    const logs = await prisma.log.findMany({
      where: whereClause,
      select: {
        staffName: true,
        department: true,
        branch: true,
        quantity: true,
        durationMinutes: true,
      },
    });

    // Merge rows whose staff name matches case-insensitively (handles accidental
    // duplicate Employee records for the same real person, e.g. "hassan nur" vs
    // "Hasan Nur") so each person's totals appear on one combined row instead of
    // being split across near-duplicate entries.
    const mergedByKey = new Map();
    for (const log of logs) {
      const normalizedName = log.staffName.trim().toLowerCase();
      const key = `${normalizedName}|${log.department}|${log.branch}`;

      if (!mergedByKey.has(key)) {
        mergedByKey.set(key, {
          staffName: log.staffName.trim(),
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
      // on the department (Ironing vs Washing).
      row.commissionEarned += calculateOrderCommission(log.quantity, log.department);
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
