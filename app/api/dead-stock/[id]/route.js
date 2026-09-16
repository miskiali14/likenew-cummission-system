import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

const VALID_COLLECTION_METHODS = ['IN_PERSON', 'DELIVERY', 'INCLUDED_IN_ORDER'];
const VALID_CATEGORIES = ['LALAAB', 'HANGER', 'BUSTE_ROOG', 'KABO'];

// Update a Dead Stock entry (edit, or mark given out) — Admin/Customer Care.
// Marking GIVEN_OUT requires saying how it left, same as a Customer Item
// claim — no commission here though, this is a tracking report only.
export async function PATCH(request, { params }) {
  const auth = requireAuth(request, ['ADMIN', 'CUSTOMER_CARE']);
  if (auth.response) return auth.response;
  const user = auth.user;

  try {
    const { id } = await params;
    const existing = await prisma.deadStock.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Entry not found' }, { status: 404 });
    }

    const body = await request.json();
    const { status, orderId, category, quantity, date, branch, givenOutMethod, givenOutNotes } = body;

    if (status === 'GIVEN_OUT' && !VALID_COLLECTION_METHODS.includes(givenOutMethod)) {
      return NextResponse.json(
        { message: 'Please select how the order was given out' },
        { status: 400 }
      );
    }
    if (category !== undefined && !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ message: 'Invalid category' }, { status: 400 });
    }

    const item = await prisma.deadStock.update({
      where: { id },
      data: {
        ...(status !== undefined && {
          status,
          givenOutAt: status === 'GIVEN_OUT' ? new Date() : null,
          givenOutById: status === 'GIVEN_OUT' ? user.id : null,
          givenOutByName: status === 'GIVEN_OUT' ? user.fullName : null,
          givenOutMethod: status === 'GIVEN_OUT' ? givenOutMethod : null,
          givenOutNotes: status === 'GIVEN_OUT' ? (givenOutNotes || null) : null,
        }),
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

// Delete a Dead Stock entry — Admin/Customer Care.
export async function DELETE(request, { params }) {
  const auth = requireAuth(request, ['ADMIN', 'CUSTOMER_CARE']);
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const existing = await prisma.deadStock.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Entry not found' }, { status: 404 });
    }

    await prisma.deadStock.delete({ where: { id } });
    return NextResponse.json({ message: 'Entry deleted successfully' });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to delete entry', error: error.message }, { status: 500 });
  }
}
