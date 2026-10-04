import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Public, unauthenticated session state for the WhatsApp bot (separate
// project, likenew-web) — lets a stateless webhook ask a question and treat
// the customer's next message as the answer. A row older than STALE_MS is
// treated as abandoned so an unrelated message days later isn't mistaken
// for a reply. CORS open since the bot lives on its own separate site.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const STALE_MS = 10 * 60 * 1000; // 10 minutes

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { waId, action, awaiting } = body;

    if (!waId) {
      return NextResponse.json({ message: 'waId is required' }, { status: 400, headers: CORS_HEADERS });
    }

    if (action === 'set') {
      if (!awaiting) {
        return NextResponse.json({ message: 'awaiting is required' }, { status: 400, headers: CORS_HEADERS });
      }
      await prisma.botSession.upsert({
        where: { waId: String(waId) },
        create: { waId: String(waId), awaiting: String(awaiting) },
        update: { awaiting: String(awaiting) },
      });
      return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
    }

    if (action === 'consume') {
      const existing = await prisma.botSession.findUnique({ where: { waId: String(waId) } });
      if (!existing) {
        return NextResponse.json({ awaiting: null }, { headers: CORS_HEADERS });
      }
      await prisma.botSession.delete({ where: { waId: String(waId) } }).catch(() => {});
      const isStale = Date.now() - new Date(existing.updatedAt).getTime() > STALE_MS;
      return NextResponse.json(
        { awaiting: isStale ? null : existing.awaiting },
        { headers: CORS_HEADERS }
      );
    }

    return NextResponse.json({ message: 'action must be "set" or "consume"' }, { status: 400, headers: CORS_HEADERS });
  } catch (error) {
    return NextResponse.json(
      { message: 'A server error occurred', error: error.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
