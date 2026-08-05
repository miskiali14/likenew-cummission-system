import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { ROLE_DEPARTMENT_MAP } from '@/lib/branch';

// Register a new log — Admin, Sales, QC
export async function POST(request) {
  const auth = requireAuth(request, ['ADMIN', 'SALES', 'QUALITY_CONTROL']);
  if (auth.response) return auth.response;
  const user = auth.user;

  try {
    const body = await request.json();
    const { orderId, quantity, date, shift, durationMinutes, employeeId, registrarId } = body;
    const role = user.role;

    const branch = role === 'ADMIN' ? (body.branch || 'HQ') : user.branch;
    const department = role === 'ADMIN' ? body.department : ROLE_DEPARTMENT_MAP[role];
    const registrarRole = role === 'ADMIN' ? body.registrarRole : role;

    if (!department || !['WASHING', 'IRONING'].includes(department)) {
      return NextResponse.json({ message: 'Invalid or undetermined department' }, { status: 400 });
    }
    if (!employeeId) {
      return NextResponse.json({ message: 'Please select an employee' }, { status: 400 });
    }
    if (!registrarId) {
      return NextResponse.json(
        { message: 'Please select who is registering this (Assigned By)' },
        { status: 400 }
      );
    }

    const [employee, registrar] = await Promise.all([
      prisma.employee.findUnique({ where: { id: employeeId } }),
      prisma.registrar.findUnique({ where: { id: registrarId } }),
    ]);

    if (!employee) {
      return NextResponse.json({ message: 'Employee not found' }, { status: 404 });
    }
    if (employee.branch !== branch || employee.department !== department) {
      return NextResponse.json(
        { message: 'This employee does not belong to this branch/department' },
        { status: 400 }
      );
    }
    if (!registrar) {
      return NextResponse.json({ message: 'Registrar not found' }, { status: 404 });
    }
    if (registrar.branch !== branch || registrar.role !== registrarRole) {
      return NextResponse.json(
        { message: 'This registrar does not belong to this branch/role' },
        { status: 400 }
      );
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

    return NextResponse.json(newLog, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: 'A server error occurred', error: error.message }, { status: 500 });
  }
}
