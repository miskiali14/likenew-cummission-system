import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// Fetch Employees (Admin: all/filterable; SALES/QC: their own branch only)
export async function GET(request) {
  const auth = requireAuth(request, ['ADMIN', 'SALES', 'QUALITY_CONTROL']);
  if (auth.response) return auth.response;
  const user = auth.user;

  try {
    const { searchParams } = new URL(request.url);
    const branch = searchParams.get('branch');
    const department = searchParams.get('department');
    const where = {};

    if (user.role === 'ADMIN') {
      if (branch && branch !== 'All') where.branch = branch;
    } else {
      where.branch = user.branch;
    }

    if (department && department !== 'All') where.department = department;

    const employees = await prisma.employee.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(employees);
  } catch (error) {
    return NextResponse.json(
      { message: 'Error fetching employees', error: error.message },
      { status: 500 }
    );
  }
}

// Create a new Employee (Admin only)
export async function POST(request) {
  const auth = requireAuth(request, ['ADMIN']);
  if (auth.response) return auth.response;

  try {
    const { name, branch, department } = await request.json();

    if (!name || !branch || !department) {
      return NextResponse.json(
        { message: 'Please fill in the name, branch, and department' },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.create({
      data: { name, branch, department },
    });

    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: 'Failed to create employee', error: error.message },
      { status: 500 }
    );
  }
}
