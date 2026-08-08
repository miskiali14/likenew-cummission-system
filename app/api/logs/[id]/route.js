import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { isToday } from '@/lib/date';

// Update Duration — Admin can edit any log, any date. Sales/QC can only edit
// logs in their own branch that were registered today.
export async function PATCH(request, { params }) {
  const auth = requireAuth(request, ['ADMIN', 'SALES', 'QUALITY_CONTROL']);
  if (auth.response) return auth.response;
  const user = auth.user;

  try {
    const { id } = await params;
    const { durationMinutes } = await request.json();

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

    const updatedLog = await prisma.log.update({
      where: { id },
      data: {
        durationMinutes:
          durationMinutes === undefined || durationMinutes === null || durationMinutes === ''
            ? null
            : Number(durationMinutes),
      },
    });

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
