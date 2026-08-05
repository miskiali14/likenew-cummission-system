import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { resolveBranch } from '@/lib/branch';

// Staff Summary Controller — Admin, Sales, QC
export async function GET(request) {
  const auth = requireAuth(request, ['ADMIN', 'SALES', 'QUALITY_CONTROL']);
  if (auth.response) return auth.response;
  const user = auth.user;

  try {
    const { searchParams } = new URL(request.url);
    const branch = resolveBranch(user, searchParams);
    const department = searchParams.get('department');
    const date = searchParams.get('date');

    const whereClause = {};
    if (branch) whereClause.branch = branch;
    if (department && department !== 'All') whereClause.department = department;
    if (date) whereClause.date = date;

    const summary = await prisma.log.groupBy({
      by: ['staffName', 'employeeId', 'department', 'branch'],
      where: whereClause,
      _sum: { quantity: true, durationMinutes: true },
      _count: { id: true },
    });

    const employeeIds = summary.map((s) => s.employeeId).filter(Boolean);
    const employees = employeeIds.length
      ? await prisma.employee.findMany({ where: { id: { in: employeeIds } } })
      : [];
    const rateByEmployeeId = Object.fromEntries(employees.map((e) => [e.id, e.rate]));

    const isAdmin = user.role === 'ADMIN';

    // Merge rows whose staff name matches case-insensitively (handles accidental
    // duplicate Employee records for the same real person, e.g. "hassan nur" vs
    // "Hasan Nur") so each person's totals appear on one combined row instead of
    // being split across near-duplicate entries.
    const mergedByKey = new Map();
    for (const item of summary) {
      const normalizedName = item.staffName.trim().toLowerCase();
      const key = `${normalizedName}|${item.department}|${item.branch}`;
      const totalQuantity = item._sum.quantity || 0;
      const rate = item.employeeId ? rateByEmployeeId[item.employeeId] : undefined;

      if (!mergedByKey.has(key)) {
        mergedByKey.set(key, {
          staffName: item.staffName.trim(),
          department: item.department,
          branch: item.branch,
          totalQuantity: 0,
          totalDuration: 0,
          totalOrdersHandled: 0,
          commissionEarned: 0,
          anyKnownRate: false,
        });
      }

      const row = mergedByKey.get(key);
      row.totalQuantity += totalQuantity;
      row.totalDuration += item._sum.durationMinutes || 0;
      row.totalOrdersHandled += item._count.id || 0;
      if (isAdmin && rate !== undefined) {
        row.commissionEarned += totalQuantity * rate;
        row.anyKnownRate = true;
      }
    }

    const formattedSummary = Array.from(mergedByKey.values())
      .map((row) => {
        const result = {
          staffName: row.staffName,
          department: row.department,
          branch: row.branch,
          totalQuantity: row.totalQuantity,
          totalDuration: row.totalDuration,
          totalOrdersHandled: row.totalOrdersHandled,
        };
        // Commission amounts are Admin-only, per branch owner's decision.
        if (isAdmin) {
          result.commissionEarned = row.anyKnownRate ? row.commissionEarned : null;
        }
        return result;
      })
      .sort((a, b) => b.totalQuantity - a.totalQuantity);

    return NextResponse.json(formattedSummary);
  } catch (error) {
    return NextResponse.json({ message: 'A server error occurred', error: error.message }, { status: 500 });
  }
}
