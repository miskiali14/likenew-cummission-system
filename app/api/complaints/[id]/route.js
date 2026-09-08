import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// Update a complaint (status, resolution notes, details) — Admin and
// Customer Care only, any branch. Sales can log complaints but does not
// manage or see how they were resolved.
export async function PATCH(request, { params }) {
  const auth = requireAuth(request, ['ADMIN', 'CUSTOMER_CARE']);
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const existing = await prisma.complaint.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Complaint not found' }, { status: 404 });
    }

    const body = await request.json();
    const { status, customerName, phone, orderId, category, description, date, resolutionNotes, branch } = body;

    // Admin and Customer Care may move a complaint between branches.
    const nextBranch = branch !== undefined ? branch : undefined;

    const complaint = await prisma.complaint.update({
      where: { id },
      data: {
        ...(status !== undefined && {
          status,
          resolvedAt: status === 'RESOLVED' ? new Date() : null,
        }),
        ...(customerName !== undefined && { customerName }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(orderId !== undefined && { orderId: orderId || null }),
        ...(category !== undefined && { category }),
        ...(description !== undefined && { description }),
        ...(date !== undefined && { date }),
        ...(resolutionNotes !== undefined && { resolutionNotes: resolutionNotes || null }),
        ...(nextBranch !== undefined && { branch: nextBranch }),
      },
    });

    return NextResponse.json(complaint);
  } catch (error) {
    return NextResponse.json({ message: 'Failed to update complaint', error: error.message }, { status: 500 });
  }
}

// Delete a complaint — Admin and Customer Care only, any branch.
export async function DELETE(request, { params }) {
  const auth = requireAuth(request, ['ADMIN', 'CUSTOMER_CARE']);
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const existing = await prisma.complaint.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Complaint not found' }, { status: 404 });
    }

    await prisma.complaint.delete({ where: { id } });
    return NextResponse.json({ message: 'Complaint deleted successfully' });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to delete complaint', error: error.message }, { status: 500 });
  }
}
