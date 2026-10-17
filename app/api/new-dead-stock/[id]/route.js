import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

const VALID_COLLECTION_METHODS = ['IN_PERSON', 'DELIVERY', 'INCLUDED_IN_ORDER'];
const RESOLVED_STATUSES = ['GIVEN_OUT', 'DONATED', 'DISCARDED'];
// Sales/Call Center can log an entry AND resolve it (give out / donate /
// discard, or move it back to in stock) — but editing the entry's own
// details or deleting it stays with Admin/Customer Care/Customer Ops.
const CAN_RESOLVE = ['ADMIN', 'CUSTOMER_CARE', 'CUSTOMER_OPS', 'SALES', 'CALL_CENTER'];
const CAN_EDIT_DELETE = ['ADMIN', 'CUSTOMER_CARE', 'CUSTOMER_OPS'];

export async function PATCH(request, { params }) {
  const auth = requireAuth(request, CAN_RESOLVE);
  if (auth.response) return auth.response;
  const user = auth.user;
  const canEdit = CAN_EDIT_DELETE.includes(user.role);

  try {
    const { id } = await params;
    const existing = await prisma.newDeadStock.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Entry not found' }, { status: 404 });
    }

    const body = await request.json();
    const { status, customerName, customerId, phone, orderId, category, quantity, date, branch, loggedByName, givenOutMethod, givenOutNotes, givenOutByName } = body;

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
    // Same reasoning as createdByName at logging time — the account is
    // often a shared branch login, so the real person is picked from the
    // staff dropdown rather than assumed from whoever is authenticated.
    if (RESOLVED_STATUSES.includes(status) && !(givenOutByName && givenOutByName.trim())) {
      return NextResponse.json({ message: 'Please select who is resolving this entry' }, { status: 400 });
    }
    if (category !== undefined && !String(category).trim()) {
      return NextResponse.json({ message: 'Invalid category' }, { status: 400 });
    }
    // Sales/Call Center can resolve (status + its related fields) but not
    // edit the entry's own details — ignore those fields entirely for them,
    // regardless of what the request body contains.
    if (!canEdit && (customerName !== undefined || customerId !== undefined || phone !== undefined || orderId !== undefined || category !== undefined || quantity !== undefined || date !== undefined || branch !== undefined || loggedByName !== undefined)) {
      return NextResponse.json(
        { message: 'You can resolve this entry but not edit its details' },
        { status: 403 }
      );
    }

    const item = await prisma.newDeadStock.update({
      where: { id },
      data: {
        ...(status !== undefined && {
          status,
          givenOutAt: RESOLVED_STATUSES.includes(status) ? new Date() : null,
          givenOutById: RESOLVED_STATUSES.includes(status) ? user.id : null,
          givenOutByName: RESOLVED_STATUSES.includes(status) ? givenOutByName.trim() : null,
          givenOutMethod: status === 'GIVEN_OUT' ? givenOutMethod : null,
          givenOutNotes: RESOLVED_STATUSES.includes(status) ? (givenOutNotes || null) : null,
        }),
        ...(canEdit && customerName !== undefined && { customerName }),
        ...(canEdit && customerId !== undefined && { customerId: String(customerId) }),
        ...(canEdit && phone !== undefined && { phone }),
        ...(canEdit && orderId !== undefined && { orderId: String(orderId) }),
        ...(canEdit && category !== undefined && { category }),
        ...(canEdit && quantity !== undefined && { quantity: Number(quantity) > 0 ? Number(quantity) : 1 }),
        ...(canEdit && date !== undefined && { date }),
        ...(canEdit && branch !== undefined && { branch }),
        ...(canEdit && loggedByName !== undefined && { createdByName: loggedByName }),
      },
    });

    return NextResponse.json(item);
  } catch (error) {
    return NextResponse.json({ message: 'Failed to update entry', error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const auth = requireAuth(request, CAN_EDIT_DELETE);
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
