import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

const VALID_COLLECTION_METHODS = ['IN_PERSON', 'DELIVERY', 'INCLUDED_IN_ORDER'];
// Terminal outcomes for an item — all three earn the person who resolved it
// a commission. CLAIMED requires picking a collection method; DONATED/
// DISCARDED (customer said give it away / throw it out) have no collection
// method to pick, so they require a written reason/method instead.
const RESOLVED_STATUSES = ['CLAIMED', 'DONATED', 'DISCARDED'];

// Update a Customer Item (mark claimed/donated/discarded, edit details) —
// Admin any item; Call Center only an item they personally logged (or a
// legacy one with no owner). Sales has no access to Customer Items at all.
export async function PATCH(request, { params }) {
  const auth = requireAuth(request, ['ADMIN', 'CALL_CENTER']);
  if (auth.response) return auth.response;
  const user = auth.user;

  try {
    const { id } = await params;
    const existing = await prisma.customerItem.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Item not found' }, { status: 404 });
    }
    if (user.role !== 'ADMIN' && existing.createdById && existing.createdById !== user.id) {
      return NextResponse.json({ message: 'This item was not logged by you' }, { status: 403 });
    }

    const body = await request.json();
    const { status, customerId, customerName, phone, description, date, branch, collectionMethod, collectionNotes } = body;

    if (status === 'CLAIMED' && !VALID_COLLECTION_METHODS.includes(collectionMethod)) {
      return NextResponse.json(
        { message: 'Please select how the item was collected' },
        { status: 400 }
      );
    }
    if ((status === 'DONATED' || status === 'DISCARDED') && !(collectionNotes && collectionNotes.trim())) {
      return NextResponse.json(
        { message: 'Please describe how/why the item was donated or discarded' },
        { status: 400 }
      );
    }

    // Only Admin may move an item between branches.
    const nextBranch = user.role === 'ADMIN' && branch !== undefined ? branch : undefined;

    const item = await prisma.customerItem.update({
      where: { id },
      data: {
        ...(status !== undefined && {
          status,
          claimedAt: RESOLVED_STATUSES.includes(status) ? new Date() : null,
          claimedById: RESOLVED_STATUSES.includes(status) ? user.id : null,
          claimedByName: RESOLVED_STATUSES.includes(status) ? user.fullName : null,
          collectionMethod: status === 'CLAIMED' ? collectionMethod : null,
          collectionNotes: RESOLVED_STATUSES.includes(status) ? (collectionNotes || null) : null,
        }),
        ...(customerId !== undefined && { customerId: String(customerId) }),
        ...(customerName !== undefined && { customerName }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(description !== undefined && { description }),
        ...(date !== undefined && { date }),
        ...(nextBranch !== undefined && { branch: nextBranch }),
      },
    });

    return NextResponse.json(item);
  } catch (error) {
    return NextResponse.json({ message: 'Failed to update item', error: error.message }, { status: 500 });
  }
}

// Delete a Customer Item — Admin any item, Call Center only one they
// logged (or a legacy one with no owner). Sales has no access at all.
export async function DELETE(request, { params }) {
  const auth = requireAuth(request, ['ADMIN', 'CALL_CENTER']);
  if (auth.response) return auth.response;
  const user = auth.user;

  try {
    const { id } = await params;
    const existing = await prisma.customerItem.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Item not found' }, { status: 404 });
    }
    if (user.role !== 'ADMIN' && existing.createdById && existing.createdById !== user.id) {
      return NextResponse.json({ message: 'This item was not logged by you' }, { status: 403 });
    }

    await prisma.customerItem.delete({ where: { id } });
    return NextResponse.json({ message: 'Item deleted successfully' });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to delete item', error: error.message }, { status: 500 });
  }
}
