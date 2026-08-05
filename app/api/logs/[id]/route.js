import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// Update Duration Only — Admin, Sales, QC (non-admins limited to their own branch)
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
    if (user.role !== 'ADMIN' && existingLog.branch !== user.branch) {
      return NextResponse.json(
        { message: 'You do not have permission to modify this log' },
        { status: 403 }
      );
    }

    const updatedLog = await prisma.log.update({
      where: { id },
      data: { durationMinutes: Number(durationMinutes) },
    });

    return NextResponse.json(updatedLog);
  } catch (error) {
    return NextResponse.json({ message: 'A server error occurred', error: error.message }, { status: 500 });
  }
}

// Delete Log — Admin only, corrects mistaken entries
export async function DELETE(request, { params }) {
  const auth = requireAuth(request, ['ADMIN']);
  if (auth.response) return auth.response;

  try {
    const { id } = await params;

    const existingLog = await prisma.log.findUnique({ where: { id } });
    if (!existingLog) {
      return NextResponse.json({ message: 'Log not found' }, { status: 404 });
    }

    await prisma.log.delete({ where: { id } });
    return NextResponse.json({ message: 'Log deleted successfully' });
  } catch (error) {
    return NextResponse.json({ message: 'A server error occurred', error: error.message }, { status: 500 });
  }
}
