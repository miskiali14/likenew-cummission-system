import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// Delete User — ADMIN only
export async function DELETE(request, { params }) {
  const auth = requireAuth(request, ['ADMIN']);
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('🔥 Error deleting user:', error);
    return NextResponse.json(
      { message: 'An error occurred while deleting the user', error: error.message },
      { status: 500 }
    );
  }
}
