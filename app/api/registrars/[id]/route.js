import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// Update Registrar — Admin only
export async function PATCH(request, { params }) {
  const auth = requireAuth(request, ['ADMIN']);
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const { name, branch, role, status } = await request.json();

    const registrar = await prisma.registrar.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(branch !== undefined && { branch }),
        ...(role !== undefined && { role }),
        ...(status !== undefined && { status }),
      },
    });

    return NextResponse.json(registrar);
  } catch (error) {
    return NextResponse.json(
      { message: 'Failed to update registrar', error: error.message },
      { status: 500 }
    );
  }
}

// Delete Registrar — Admin only
export async function DELETE(request, { params }) {
  const auth = requireAuth(request, ['ADMIN']);
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    await prisma.registrar.delete({ where: { id } });
    return NextResponse.json({ message: 'Registrar deleted successfully' });
  } catch (error) {
    return NextResponse.json(
      { message: 'Failed to delete registrar', error: error.message },
      { status: 500 }
    );
  }
}
