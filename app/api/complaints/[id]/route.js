import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

const VALID_RESPONSIBLE_DEPARTMENTS = [
  'SALES_HQ', 'SALES_KM5',
  'WASHING_HQ', 'WASHING_KM5',
  'IRONING_HQ', 'IRONING_KM5',
];

// Update a complaint (status, resolution notes, details) — Admin and
// Customer Care only, any branch. Sales can log complaints but does not
// manage or see how they were resolved. Resolving requires saying which
// team/branch was actually responsible for the issue.
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
    const {
      status, customerName, phone, orderId, category, description, date,
      resolutionNotes, branch, responsibleDepartment, responsibleName,
    } = body;

    if (status === 'RESOLVED' && !VALID_RESPONSIBLE_DEPARTMENTS.includes(responsibleDepartment)) {
      return NextResponse.json(
        { message: 'Please select who is responsible for this complaint' },
        { status: 400 }
      );
    }

    // Admin and Customer Care may move a complaint between branches.
    const nextBranch = branch !== undefined ? branch : undefined;

    const complaint = await prisma.complaint.update({
      where: { id },
      data: {
        ...(status !== undefined && {
          status,
          resolvedAt: status === 'RESOLVED' ? new Date() : null,
          responsibleDepartment: status === 'RESOLVED' ? responsibleDepartment : null,
          responsibleName: status === 'RESOLVED' ? (responsibleName || null) : null,
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
