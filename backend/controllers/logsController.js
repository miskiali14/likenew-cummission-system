import prisma from '../prisma.js';

const ROLE_DEPARTMENT_MAP = {
  SALES: 'WASHING',
  QUALITY_CONTROL: 'IRONING',
};

// Branch isolation boundary: non-admins can never see/write outside their own
// branch, regardless of what a client sends in the query/body.
const resolveBranch = (req) => {
  if (req.user?.role === 'ADMIN') {
    const { branch } = req.query;
    return branch && branch !== 'All' ? branch : undefined;
  }
  return req.user?.branch;
};

// 1. Admin Stats Controller (/api/logs/stats)
export const getAdminStats = async (req, res, next) => {
  try {
    const branch = resolveBranch(req);
    const whereClause = branch ? { branch } : {};

    const [washing, ironing, totalOrders, commissionLogs] = await Promise.all([
      prisma.log.count({ where: { ...whereClause, department: 'WASHING' } }),
      prisma.log.count({ where: { ...whereClause, department: 'IRONING' } }),
      prisma.log.count({ where: whereClause }),
      prisma.log.findMany({
        where: { ...whereClause, employeeId: { not: null } },
        select: { quantity: true, employee: { select: { rate: true } } },
      }),
    ]);

    const totalCommission = commissionLogs.reduce(
      (sum, log) => sum + log.quantity * (log.employee?.rate || 0),
      0
    );

    return res.status(200).json({
      washing,
      ironing,
      totalOrders,
      totalCommission,
    });
  } catch (error) {
    next(error);
  }
};

// 2. Admin All Logs Controller (/api/logs/all)
export const getAllLogs = async (req, res, next) => {
  try {
    const branch = resolveBranch(req);
    const { department } = req.query;

    const whereClause = {};
    if (branch) whereClause.branch = branch;
    if (department && department !== 'All') whereClause.department = department;

    const logs = await prisma.log.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json(logs);
  } catch (error) {
    next(error);
  }
};

// 3. Washing Logs (Sales & Admin)
export const getWashingLogs = async (req, res, next) => {
  try {
    const branch = resolveBranch(req);
    const whereClause = { department: 'WASHING' };
    if (branch) whereClause.branch = branch;

    const logs = await prisma.log.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json(logs);
  } catch (error) {
    next(error);
  }
};

// 4. Ironing Logs (QC & Admin)
export const getIroningLogs = async (req, res, next) => {
  try {
    const branch = resolveBranch(req);
    const whereClause = { department: 'IRONING' };
    if (branch) whereClause.branch = branch;

    const logs = await prisma.log.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json(logs);
  } catch (error) {
    next(error);
  }
};

// 5. Create Log
export const createLog = async (req, res, next) => {
  try {
    const { orderId, quantity, date, shift, durationMinutes, employeeId, registrarId } = req.body;
    const role = req.user.role;

    const branch = role === 'ADMIN' ? (req.body.branch || 'HQ') : req.user.branch;
    const department = role === 'ADMIN' ? req.body.department : ROLE_DEPARTMENT_MAP[role];
    const registrarRole = role === 'ADMIN' ? req.body.registrarRole : role;

    if (!department || !['WASHING', 'IRONING'].includes(department)) {
      return res.status(400).json({ message: 'Invalid or undetermined department' });
    }
    if (!employeeId) {
      return res.status(400).json({ message: 'Please select an employee' });
    }
    if (!registrarId) {
      return res.status(400).json({ message: 'Please select who is registering this (Assigned By)' });
    }

    const [employee, registrar] = await Promise.all([
      prisma.employee.findUnique({ where: { id: employeeId } }),
      prisma.registrar.findUnique({ where: { id: registrarId } }),
    ]);

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    if (employee.branch !== branch || employee.department !== department) {
      return res.status(400).json({ message: 'This employee does not belong to this branch/department' });
    }
    if (!registrar) {
      return res.status(404).json({ message: 'Registrar not found' });
    }
    if (registrar.branch !== branch || registrar.role !== registrarRole) {
      return res.status(400).json({ message: 'This registrar does not belong to this branch/role' });
    }

    const newLog = await prisma.log.create({
      data: {
        orderId: Number(orderId),
        quantity: Number(quantity),
        date,
        assignedBy: registrar.name,
        registrarId: registrar.id,
        shift,
        staffName: employee.name,
        employeeId: employee.id,
        durationMinutes: Number(durationMinutes),
        department,
        branch,
      },
    });

    return res.status(201).json(newLog);
  } catch (error) {
    next(error);
  }
};

// 6. Update Duration Only (/api/logs/:id)
export const updateLogDuration = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { durationMinutes } = req.body;

    const existingLog = await prisma.log.findUnique({ where: { id } });
    if (!existingLog) {
      return res.status(404).json({ message: 'Log not found' });
    }
    if (req.user.role !== 'ADMIN' && existingLog.branch !== req.user.branch) {
      return res.status(403).json({ message: 'You do not have permission to modify this log' });
    }

    const updatedLog = await prisma.log.update({
      where: { id },
      data: { durationMinutes: Number(durationMinutes) },
    });

    return res.status(200).json(updatedLog);
  } catch (error) {
    next(error);
  }
};

// 6b. Delete Log (/api/logs/:id) — Admin only, corrects mistaken entries
export const deleteLog = async (req, res, next) => {
  try {
    const { id } = req.params;

    const existingLog = await prisma.log.findUnique({ where: { id } });
    if (!existingLog) {
      return res.status(404).json({ message: 'Log not found' });
    }

    await prisma.log.delete({ where: { id } });
    return res.status(200).json({ message: 'Log deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// 7. Staff Summary Controller (/api/logs/staff-summary)
export const getStaffSummary = async (req, res, next) => {
  try {
    const branch = resolveBranch(req);
    const { department, date } = req.query;

    const whereClause = {};
    if (branch) whereClause.branch = branch;
    if (department && department !== 'All') whereClause.department = department;
    if (date) whereClause.date = date;

    const summary = await prisma.log.groupBy({
      by: ['staffName', 'employeeId', 'department', 'branch'],
      where: whereClause,
      _sum: {
        quantity: true,
        durationMinutes: true,
      },
      _count: {
        id: true,
      },
    });

    const employeeIds = summary.map((s) => s.employeeId).filter(Boolean);
    const employees = employeeIds.length
      ? await prisma.employee.findMany({ where: { id: { in: employeeIds } } })
      : [];
    const rateByEmployeeId = Object.fromEntries(employees.map((e) => [e.id, e.rate]));

    const isAdmin = req.user.role === 'ADMIN';

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

    return res.status(200).json(formattedSummary);
  } catch (error) {
    next(error);
  }
};

// 8. Personal Logs (/api/logs/my-logs?registrarId=...)
// Since one shared branch login (e.g. "Sales HQ") is used by several named
// registrars day to day, "my logs" is scoped to whichever Registrar is
// currently selected in the log form, not the login account itself.
export const getMyLogs = async (req, res, next) => {
  try {
    const { registrarId } = req.query;

    if (!registrarId) {
      return res.status(400).json({
        message: "Please select who is registering this (Assigned By)",
      });
    }

    const registrar = await prisma.registrar.findUnique({ where: { id: registrarId } });
    if (!registrar) {
      return res.status(404).json({ message: "Registrar not found" });
    }
    if (req.user.role !== 'ADMIN' && registrar.branch !== req.user.branch) {
      return res.status(403).json({ message: 'You do not have permission to view this person' });
    }

    const whereClause = { registrarId };

    const [logs, summary] = await Promise.all([
      prisma.log.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
      }),
      prisma.log.aggregate({
        where: whereClause,
        _sum: { quantity: true, durationMinutes: true },
        _count: { id: true },
      }),
    ]);

    return res.status(200).json({
      staffName: registrar.name,
      totalQuantity: summary._sum.quantity || 0,
      totalDuration: summary._sum.durationMinutes || 0,
      totalOrdersHandled: summary._count.id || 0,
      logs,
    });
  } catch (error) {
    next(error);
  }
};
