import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { isToday } from '@/lib/date';

// Update an order — Admin can edit any log, any date. Sales/QC can only edit
// logs in their own branch that were registered today. Any of orderId,
// quantity, shift, employeeId, durationMinutes may be included; only the
// fields present in the body are changed.
export async function PATCH(request, { params }) {
  const auth = requireAuth(request, ['ADMIN', 'SALES', 'QUALITY_CONTROL']);
  if (auth.response) return auth.response;
  const user = auth.user;

  try {
    const { id } = await params;
    const body = await request.json();

    const existingLog = await prisma.log.findUnique({ where: { id } });
    if (!existingLog) {
      return NextResponse.json({ message: 'Log not found' }, { status: 404 });
    }
    if (user.role !== 'ADMIN') {
      if (existingLog.branch !== user.branch) {
        return NextResponse.json(
          { message: 'You do not have permission to modify this log' },
          { status: 403 }
        );
      }
      if (!isToday(existingLog.date)) {
        return NextResponse.json(
          { message: 'You can only edit orders registered today' },
          { status: 403 }
        );
      }
    }

    const data = {};
    if (body.orderId !== undefined) data.orderId = Number(body.orderId);
    if (body.quantity !== undefined) data.quantity = Number(body.quantity);
    if (body.shift !== undefined) data.shift = body.shift;
    if (body.durationMinutes !== undefined) {
      data.durationMinutes =
        body.durationMinutes === null || body.durationMinutes === ''
          ? null
          : Number(body.durationMinutes);
    }

    if (body.employeeId !== undefined && body.employeeId !== existingLog.employeeId) {
      const employee = await prisma.employee.findUnique({ where: { id: body.employeeId } });
      if (!employee) {
        return NextResponse.json({ message: 'Employee not found' }, { status: 404 });
      }
      if (employee.branch !== existingLog.branch || employee.department !== existingLog.department) {
        return NextResponse.json(
          { message: 'This employee does not belong to this order\'s branch/department' },
          { status: 400 }
        );
      }
      data.employeeId = employee.id;
      data.staffName = employee.name;
    }

    const updatedLog = await prisma.log.update({ where: { id }, data });

    return NextResponse.json(updatedLog);
  } catch (error) {
    return NextResponse.json({ message: 'A server error occurred', error: error.message }, { status: 500 });
  }
}

// Delete Log — Admin can delete any log, any date (corrects mistaken entries).
// Sales/QC can only delete logs in their own branch that were registered today.
export async function DELETE(request, { params }) {
  const auth = requireAuth(request, ['ADMIN', 'SALES', 'QUALITY_CONTROL']);
  if (auth.response) return auth.response;
  const user = auth.user;

  try {
    const { id } = await params;

    const existingLog = await prisma.log.findUnique({ where: { id } });
    if (!existingLog) {
      return NextResponse.json({ message: 'Log not found' }, { status: 404 });
    }

    if (user.role !== 'ADMIN') {
      if (existingLog.branch !== user.branch) {
        return NextResponse.json(
          { message: 'You do not have permission to delete this log' },
          { status: 403 }
        );
      }
      if (!isToday(existingLog.date)) {
        return NextResponse.json(
          { message: 'You can only delete orders registered today' },
          { status: 403 }
        );
      }
    }

    await prisma.log.delete({ where: { id } });
    return NextResponse.json({ message: 'Log deleted successfully' });
  } catch (error) {
    return NextResponse.json({ message: 'A server error occurred', error: error.message }, { status: 500 });
  }
}
