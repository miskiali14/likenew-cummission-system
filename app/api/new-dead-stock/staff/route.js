import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// Real staff names selectable on a New Dead Stock entry (logged by / given
// out by), since Sales and Call Center accounts are shared branch logins.
// Anyone who can log an entry needs to read this list; only the management
// tier can add a new name.
const CAN_READ = ['ADMIN', 'CUSTOMER_CARE', 'CUSTOMER_OPS', 'SALES', 'CALL_CENTER'];
const CAN_MANAGE = ['ADMIN', 'CUSTOMER_CARE', 'CUSTOMER_OPS'];

export async function GET(request) {
  const auth = requireAuth(request, CAN_READ);
  if (auth.response) return auth.response;

  try {
    const staff = await prisma.newDeadStockStaff.findMany({
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(staff);
  } catch (error) {
    return NextResponse.json({ message: 'A server error occurred', error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = requireAuth(request, CAN_MANAGE);
  if (auth.response) return auth.response;

  try {
    const body = await request.json();
    const name = (body.name || '').trim();
    const branch = body.branch || 'HQ';

    if (!name) {
      return NextResponse.json({ message: 'Please enter a name' }, { status: 400 });
    }

    const staff = await prisma.newDeadStockStaff.create({ data: { name, branch } });
    return NextResponse.json(staff, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to save name', error: error.message }, { status: 500 });
  }
}
