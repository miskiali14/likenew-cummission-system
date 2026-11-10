import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

const CAN_ACCESS = ['ADMIN', 'RECRUITER'];

// Delete a job application — used to clear out spam or applicants who have
// already been dealt with. Rows are never created from the dashboard, so
// there's no PATCH/update here, just removal.
export async function DELETE(request, { params }) {
  const auth = requireAuth(request, CAN_ACCESS);
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const existing = await prisma.jobApplication.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Application not found' }, { status: 404 });
    }

    await prisma.jobApplication.delete({ where: { id } });
    return NextResponse.json({ message: 'Application deleted successfully' });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to delete application', error: error.message }, { status: 500 });
  }
}
