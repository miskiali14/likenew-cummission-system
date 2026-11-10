import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// Read-only — rows are only ever created by the public careers form intake
// (/api/public/job-applications), never from the dashboard itself.
const CAN_ACCESS = ['ADMIN'];

export async function GET(request) {
  const auth = requireAuth(request, CAN_ACCESS);
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const roleParam = searchParams.get('role');

    const whereClause = {};
    if (roleParam && roleParam !== 'All') whereClause.role = roleParam;

    const applications = await prisma.jobApplication.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(applications);
  } catch (error) {
    return NextResponse.json({ message: 'A server error occurred', error: error.message }, { status: 500 });
  }
}
