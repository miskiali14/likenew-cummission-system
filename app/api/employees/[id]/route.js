import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// Update Employee (rate, status, etc.) — Admin only
export async function PATCH(request, { params }) {
  const auth = requireAuth(request, ['ADMIN']);
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const { name, branch, department, rate, status } = await request.json();

    const employee = await prisma.employee.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(branch !== undefined && { branch }),
        ...(department !== undefined && { department }),
        ...(rate !== undefined && { rate: Number(rate) }),
        ...(status !== undefined && { status }),
      },
    });

    return NextResponse.json(employee);
  } catch (error) {
    return NextResponse.json(
      { message: 'Failed to update employee', error: error.message },
      { status: 500 }
    );
  }
}

// Delete Employee — Admin only
export async function DELETE(request, { params }) {
  const auth = requireAuth(request, ['ADMIN']);
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    await prisma.employee.delete({ where: { id } });
    return NextResponse.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    return NextResponse.json(
      { message: 'Failed to delete employee', error: error.message },
      { status: 500 }
    );
  }
}
