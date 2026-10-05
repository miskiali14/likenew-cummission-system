import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// Change a user's password — ADMIN only. Admin sets a new password
// directly (never sees or recovers the old one); no self-service "forgot
// password" flow exists since the app sends no email/SMS.
export async function PATCH(request, { params }) {
  const auth = requireAuth(request, ['ADMIN']);
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const { password } = await request.json();

    if (!password || password.length < 6) {
      return NextResponse.json(
        { message: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.update({ where: { id }, data: { password: hashedPassword } });

    return NextResponse.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('🔥 Error updating password:', error);
    return NextResponse.json(
      { message: 'Failed to update password', error: error.message },
      { status: 500 }
    );
  }
}

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
