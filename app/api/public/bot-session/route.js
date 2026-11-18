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

    // Atomic once-only claim — unlike set/consume (read-then-write, racy
    // under two near-simultaneous callers), this relies on the primary key
    // unique constraint: only the first of two concurrent claims on the same
    // waId can succeed. Used to dedupe a WhatsApp provider delivering the
    // same inbound message more than once, so the bot doesn't reply twice.
    if (action === 'claim') {
      try {
        await prisma.botSession.create({
          data: { waId: String(waId), awaiting: String(awaiting || 'CLAIMED') },
        });
        return NextResponse.json({ claimed: true }, { headers: CORS_HEADERS });
      } catch (error) {
        if (error.code === 'P2002') {
          return NextResponse.json({ claimed: false }, { headers: CORS_HEADERS });
        }
        throw error;
      }
    }

    return NextResponse.json({ message: 'action must be "set", "consume" or "claim"' }, { status: 400, headers: CORS_HEADERS });
  } catch (error) {
    return NextResponse.json(
      { message: 'A server error occurred', error: error.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
