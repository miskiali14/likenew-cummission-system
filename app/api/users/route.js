import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// Fetch all Users (ADMIN only)
export async function GET(request) {
  const auth = requireAuth(request, ['ADMIN']);
  if (auth.response) return auth.response;

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        branch: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error('🔥 Error fetching users:', error);
    return NextResponse.json(
      { message: 'Failed to fetch users', error: error.message },
      { status: 500 }
    );
  }
}

// Create a new User (Sales, Admin, QC) — ADMIN only
export async function POST(request) {
  const auth = requireAuth(request, ['ADMIN']);
  if (auth.response) return auth.response;

  try {
    const { name, email, password, role, branch } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { message: 'Please fill in the name, email, and password' },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ message: 'This email is already in use' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        fullName: name,
        email,
        password: hashedPassword,
        role: role || 'SALES',
        branch: role === 'ADMIN' ? null : (branch || 'HQ'),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        branch: true,
      },
    });

    return NextResponse.json(
      { message: 'User created successfully', user: newUser },
      { status: 201 }
    );
  } catch (error) {
    console.error('🔥 Error creating user:', error);
    return NextResponse.json(
      { message: 'Failed to create user', error: error.message },
      { status: 500 }
    );
  }
}
