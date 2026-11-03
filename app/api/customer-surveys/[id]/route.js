import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

const CAN_ACCESS = ['ADMIN', 'CUSTOMER_CARE', 'CUSTOMER_OPS'];

export async function PATCH(request, { params }) {
  const auth = requireAuth(request, CAN_ACCESS);
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const existing = await prisma.customerCallSurvey.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Entry not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      customerName, phone, date, branch,
      hasComplaint, complaintNotes, tourGiven, packageGiven,
      satisfaction, qualityRating, desiredService, suggestedChanges,
    } = body;

    if (hasComplaint !== undefined && hasComplaint && !(complaintNotes && complaintNotes.trim())) {
      return NextResponse.json({ message: 'Please describe the complaint' }, { status: 400 });
    }

    const item = await prisma.customerCallSurvey.update({
      where: { id },
      data: {
        ...(customerName !== undefined && { customerName }),
        ...(phone !== undefined && { phone }),
        ...(date !== undefined && { date }),
        ...(branch !== undefined && { branch }),
        ...(hasComplaint !== undefined && {
          hasComplaint: Boolean(hasComplaint),
          complaintNotes: hasComplaint ? complaintNotes.trim() : null,
        }),
        ...(tourGiven !== undefined && { tourGiven: Boolean(tourGiven) }),
        ...(packageGiven !== undefined && { packageGiven: Boolean(packageGiven) }),
        ...(satisfaction !== undefined && { satisfaction: satisfaction || null }),
        ...(qualityRating !== undefined && { qualityRating: qualityRating || null }),
        ...(desiredService !== undefined && { desiredService: desiredService || null }),
        ...(suggestedChanges !== undefined && { suggestedChanges: suggestedChanges || null }),
      },
    });

    return NextResponse.json(item);
  } catch (error) {
    return NextResponse.json({ message: 'Failed to update entry', error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const auth = requireAuth(request, CAN_ACCESS);
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const existing = await prisma.customerCallSurvey.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Entry not found' }, { status: 404 });
    }

    await prisma.customerCallSurvey.delete({ where: { id } });
    return NextResponse.json({ message: 'Entry deleted successfully' });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to delete entry', error: error.message }, { status: 500 });
  }
}
