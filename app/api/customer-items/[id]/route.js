import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

const VALID_COLLECTION_METHODS = ['IN_PERSON', 'DELIVERY', 'INCLUDED_IN_ORDER'];

// Update a Customer Item (mark claimed, edit details) — Admin any item;
// Call Center only an item they personally logged (or a legacy one with
// no owner). Sales has no access to Customer Items at all. Marking
// something CLAIMED requires saying how it was collected — that person
// earns the per-item commission tracked on the item itself.
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

    // Only Admin may move an item between branches.
    const nextBranch = user.role === 'ADMIN' && branch !== undefined ? branch : undefined;

    const item = await prisma.customerItem.update({
      where: { id },
      data: {
        ...(status !== undefined && {
          status,
          claimedAt: status === 'CLAIMED' ? new Date() : null,
          claimedById: status === 'CLAIMED' ? user.id : null,
          claimedByName: status === 'CLAIMED' ? user.fullName : null,
          collectionMethod: status === 'CLAIMED' ? collectionMethod : null,
          collectionNotes: status === 'CLAIMED' ? (collectionNotes || null) : null,
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
