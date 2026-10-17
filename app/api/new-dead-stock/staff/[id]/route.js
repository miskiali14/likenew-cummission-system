import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

const CAN_MANAGE = ['ADMIN', 'CUSTOMER_CARE', 'CUSTOMER_OPS'];

// Remove a name from the New Dead Stock staff list.
export async function DELETE(request, { params }) {
  const auth = requireAuth(request, CAN_MANAGE);
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const existing = await prisma.newDeadStockStaff.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Name not found' }, { status: 404 });
    }

    await prisma.newDeadStockStaff.delete({ where: { id } });
    return NextResponse.json({ message: 'Name removed successfully' });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to remove name', error: error.message }, { status: 500 });
  }
}
