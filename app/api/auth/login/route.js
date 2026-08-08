import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ message: 'Please enter your email and password' }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return NextResponse.json({ message: 'User does not exist' }, { status: 404 });
    }

    if (user.status !== 'ACTIVE') {
      return NextResponse.json({ message: 'This account has been disabled' }, { status: 403 });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return NextResponse.json({ message: 'Incorrect password' }, { status: 400 });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        branch: user.branch,
        department: user.department,
        fullName: user.fullName,
      },
      process.env.JWT_SECRET || 'supersecretkey',
      { expiresIn: '1d' }
    );

    return NextResponse.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        branch: user.branch,
        department: user.department,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: 'An error occurred during login', error: error.message },
      { status: 500 }
    );
  }
}
