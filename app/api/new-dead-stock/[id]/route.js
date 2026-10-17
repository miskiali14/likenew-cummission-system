import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

const VALID_COLLECTION_METHODS = ['IN_PERSON', 'DELIVERY', 'INCLUDED_IN_ORDER'];
const RESOLVED_STATUSES = ['GIVEN_OUT', 'DONATED', 'DISCARDED'];
// Sales/Call Center can log an entry but not manage it afterward — editing,
// resolving, and deleting stays with Admin/Customer Care/Customer Ops, same
// as the original Dead Stock.
const CAN_MANAGE = ['ADMIN', 'CUSTOMER_CARE', 'CUSTOMER_OPS'];

export async function PATCH(request, { params }) {
  const auth = requireAuth(request, CAN_MANAGE);
  if (auth.response) return auth.response;
  const user = auth.user;

  try {
    const { id } = await params;
    const existing = await prisma.newDeadStock.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Entry not found' }, { status: 404 });
    }

    const body = await request.json();
    const { status, customerName, customerId, phone, orderId, category, quantity, date, branch, givenOutMethod, givenOutNotes } = body;

    if (status === 'GIVEN_OUT' && !VALID_COLLECTION_METHODS.includes(givenOutMethod)) {
      return NextResponse.json(
        { message: 'Please select how the order was given out' },
        { status: 400 }
      );
    }
    // A note is required for every resolution outcome here (unlike the
    // original Dead Stock, where it's optional for GIVEN_OUT) — always
    // leave a record of what happened when something is resolved.
    if (RESOLVED_STATUSES.includes(status) && !(givenOutNotes && givenOutNotes.trim())) {
      return NextResponse.json(
        { message: 'Please add a note describing how this was resolved' },
        { status: 400 }
      );
    }
    if (category !== undefined && !String(category).trim()) {
      return NextResponse.json({ message: 'Invalid category' }, { status: 400 });
    }

    const item = await prisma.newDeadStock.update({
      where: { id },
      data: {
        ...(status !== undefined && {
          status,
          givenOutAt: RESOLVED_STATUSES.includes(status) ? new Date() : null,
          givenOutById: RESOLVED_STATUSES.includes(status) ? user.id : null,
          givenOutByName: RESOLVED_STATUSES.includes(status) ? user.fullName : null,
          givenOutMethod: status === 'GIVEN_OUT' ? givenOutMethod : null,
          givenOutNotes: RESOLVED_STATUSES.includes(status) ? (givenOutNotes || null) : null,
        }),
        ...(customerName !== undefined && { customerName }),
        ...(customerId !== undefined && { customerId: String(customerId) }),
        ...(phone !== undefined && { phone }),
        ...(orderId !== undefined && { orderId: String(orderId) }),
        ...(category !== undefined && { category }),
        ...(quantity !== undefined && { quantity: Number(quantity) > 0 ? Number(quantity) : 1 }),
        ...(date !== undefined && { date }),
        ...(branch !== undefined && { branch }),
      },
    });

    return NextResponse.json(item);
  } catch (error) {
    return NextResponse.json({ message: 'Failed to update entry', error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const auth = requireAuth(request, CAN_MANAGE);
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const existing = await prisma.newDeadStock.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Entry not found' }, { status: 404 });
    }

    await prisma.newDeadStock.delete({ where: { id } });
    return NextResponse.json({ message: 'Entry deleted successfully' });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to delete entry', error: error.message }, { status: 500 });
  }
}
