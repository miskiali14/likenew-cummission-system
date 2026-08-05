import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// Fetch Registrars (Admin: all/filterable; SALES/QC: their own branch only)
export async function GET(request) {
  const auth = requireAuth(request, ['ADMIN', 'SALES', 'QUALITY_CONTROL']);
  if (auth.response) return auth.response;
  const user = auth.user;

  try {
    const { searchParams } = new URL(request.url);
    const branch = searchParams.get('branch');
    const role = searchParams.get('role');
    const where = {};

    if (user.role === 'ADMIN') {
      if (branch && branch !== 'All') where.branch = branch;
    } else {
      where.branch = user.branch;
      where.role = user.role;
    }

    if (role && user.role === 'ADMIN') where.role = role;

    const registrars = await prisma.registrar.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(registrars);
  } catch (error) {
    return NextResponse.json(
      { message: 'Error fetching registrars', error: error.message },
      { status: 500 }
    );
  }
}

// Create a new Registrar (Admin only)
export async function POST(request) {
  const auth = requireAuth(request, ['ADMIN']);
  if (auth.response) return auth.response;

  try {
    const { name, branch, role } = await request.json();

    if (!name || !branch || !role) {
      return NextResponse.json(
        { message: 'Please fill in the name, branch, and role' },
        { status: 400 }
      );
    }
    if (!['SALES', 'QUALITY_CONTROL'].includes(role)) {
      return NextResponse.json(
        { message: 'Role must be SALES or QUALITY_CONTROL' },
        { status: 400 }
      );
    }

    const registrar = await prisma.registrar.create({ data: { name, branch, role } });
    return NextResponse.json(registrar, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: 'Failed to create registrar', error: error.message },
      { status: 500 }
    );
  }
}
