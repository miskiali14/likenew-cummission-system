import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// Update a Customer Item (mark claimed, edit details) — Admin any branch,
// Sales their own branch only.
export async function PATCH(request, { params }) {
  const auth = requireAuth(request, ['ADMIN', 'SALES']);
  if (auth.response) return auth.response;
  const user = auth.user;

  try {
    const { id } = await params;
    const existing = await prisma.customerItem.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Item not found' }, { status: 404 });
    }
    if (user.role !== 'ADMIN' && existing.branch !== user.branch) {
      return NextResponse.json({ message: 'This item does not belong to your branch' }, { status: 403 });
    }

    const body = await request.json();
    const { status, customerId, customerName, description, date, branch } = body;

    // Only Admin may move an item between branches; Sales edits stay within
    // their own branch regardless of what's sent.
    const nextBranch = user.role === 'ADMIN' && branch !== undefined ? branch : undefined;

    const item = await prisma.customerItem.update({
      where: { id },
      data: {
        ...(status !== undefined && {
          status,
          claimedAt: status === 'CLAIMED' ? new Date() : null,
        }),
        ...(customerId !== undefined && { customerId: String(customerId) }),
        ...(customerName !== undefined && { customerName }),
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

// Delete a Customer Item — Admin any branch, Sales their own branch only.
export async function DELETE(request, { params }) {
  const auth = requireAuth(request, ['ADMIN', 'SALES']);
  if (auth.response) return auth.response;
  const user = auth.user;

  try {
    const { id } = await params;
    const existing = await prisma.customerItem.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Item not found' }, { status: 404 });
    }
    if (user.role !== 'ADMIN' && existing.branch !== user.branch) {
      return NextResponse.json({ message: 'This item does not belong to your branch' }, { status: 403 });
    }

    await prisma.customerItem.delete({ where: { id } });
    return NextResponse.json({ message: 'Item deleted successfully' });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to delete item', error: error.message }, { status: 500 });
  }
}
