import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

const VALID_COLLECTION_METHODS = ['IN_PERSON', 'DELIVERY', 'INCLUDED_IN_ORDER'];
// Terminal outcomes for a dead stock order — all three earn the person who
// resolved it a commission. GIVEN_OUT requires picking a collection method;
// DONATED/DISCARDED (customer said give it away / throw it out) have no
// collection method to pick, so they require a written reason instead.
const RESOLVED_STATUSES = ['GIVEN_OUT', 'DONATED', 'DISCARDED'];

// Update a Dead Stock entry (edit, or mark given out/donated/discarded) —
// Admin/Customer Care.
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
    if ((status === 'DONATED' || status === 'DISCARDED') && !(givenOutNotes && givenOutNotes.trim())) {
      return NextResponse.json(
        { message: 'Please describe how/why the order was donated or discarded' },
        { status: 400 }
      );
    }
    if (category !== undefined && !String(category).trim()) {
      return NextResponse.json({ message: 'Invalid category' }, { status: 400 });
    }

    const item = await prisma.deadStock.update({
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
