import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request) {
  const { fullName, email, password, role, branch } = await request.json();

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      return NextResponse.json({ message: 'This email is already in use' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        password: hashedPassword,
        role: role || 'SALES',
        branch: branch || 'HQ',
        status: 'ACTIVE',
      },
    });

    return NextResponse.json(
      {
        message: 'User created successfully',
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          branch: user.branch,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { message: 'Failed to register the user', error: error.message },
      { status: 500 }
    );
  }
}
