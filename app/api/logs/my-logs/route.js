import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// Personal Logs (/api/logs/my-logs?registrarId=...)
// Since one shared branch login (e.g. "Sales HQ") is used by several named
// registrars day to day, "my logs" is scoped to whichever Registrar is
// currently selected in the log form, not the login account itself.
export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.response) return auth.response;
  const user = auth.user;

  try {
    const { searchParams } = new URL(request.url);
    const registrarId = searchParams.get('registrarId');

    if (!registrarId) {
      return NextResponse.json(
        { message: 'Please select who is registering this (Assigned By)' },
        { status: 400 }
      );
    }

    const registrar = await prisma.registrar.findUnique({ where: { id: registrarId } });
    if (!registrar) {
      return NextResponse.json({ message: 'Registrar not found' }, { status: 404 });
    }
    if (user.role !== 'ADMIN' && registrar.branch !== user.branch) {
      return NextResponse.json(
        { message: 'You do not have permission to view this person' },
        { status: 403 }
      );
    }

    const whereClause = { registrarId };

    const [logs, summary] = await Promise.all([
      prisma.log.findMany({ where: whereClause, orderBy: { createdAt: 'desc' } }),
      prisma.log.aggregate({
        where: whereClause,
        _sum: { quantity: true, durationMinutes: true },
        _count: { id: true },
      }),
    ]);

    return NextResponse.json({
      staffName: registrar.name,
      totalQuantity: summary._sum.quantity || 0,
      totalDuration: summary._sum.durationMinutes || 0,
      totalOrdersHandled: summary._count.id || 0,
      logs,
    });
  } catch (error) {
    return NextResponse.json({ message: 'A server error occurred', error: error.message }, { status: 500 });
  }
}
