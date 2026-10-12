import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// Delete a streak discount claim (mistaken entry) — Admin only.
export async function DELETE(request, { params }) {
  const auth = requireAuth(request, ['ADMIN']);
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const existing = await prisma.streakDiscount.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Claim not found' }, { status: 404 });
    }

    await prisma.streakDiscount.delete({ where: { id } });
    return NextResponse.json({ message: 'Claim deleted successfully' });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to delete claim', error: error.message }, { status: 500 });
  }
}
