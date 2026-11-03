import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/*
 * LikeNew — Dir weydiinta Feedback-ka (customer satisfaction, 1-5)
 * Method: POST
 *
 * Waxaa wici kara cron/webhook marka order-ku dhammaado (status "Completed").
 * Macmiilka WhatsApp waxaa loo diraa fariin isagoo jawaab 1-5 ah la weydiiyay;
 * jawaabtiisa waxaa qabta order-tracker (project kale, likenew-web) oo ku
 * keydiya /api/public/feedback (isla database-kan).
 *
 * Auth: ?secret=<FEEDBACK_API_SECRET> ama header x-api-secret.
 * Body: { "waId": "2526...", "orderId": "HQ-8781", "lang": "so" | "en" }
 */

const FEEDBACK_REQUEST = {
  so: (orderId) =>
    `Mahadsanid! Dalabkaaga *${orderId}* waa la dhammeeyay.\n\n` +
    'Sideed u qiimeeyaysaa adeeggan? Jawaab hal number 1-5.\n' +
    '(1 = aad u xun, 5 = aad u fiican)',
  en: (orderId) =>
    `Thank you! Your order *${orderId}* has been completed.\n\n` +
    'How would you rate our service? Reply with a single number 1-5.\n' +
    '(1 = very poor, 5 = excellent)',
};

async function sendWatiMessage(waId, text) {
  const endpoint = process.env.WATI_API_ENDPOINT;
  const token = process.env.WATI_API_TOKEN;
  if (!endpoint || !token) {
    console.error('WATI_API_ENDPOINT / WATI_API_TOKEN lama dejin');
    return { sent: false, reason: 'not_configured' };
  }
  const rawTok = String(token).replace(/[^\x20-\x7E]/g, '').trim();
  const bare = rawTok.replace(/^bearer\s+/i, '');
  const base = endpoint.replace(/[^\x20-\x7E]/g, '').replace(/\/$/, '');
  const digits = String(waId).replace(/\D/g, '');

  const qs = new URLSearchParams({ messageText: String(text) }).toString();
  const url = `${base}/api/v1/sendSessionMessage/${digits}?${qs}`;

  const attempts = [`Bearer ${bare}`, bare];
  let last = null;
  for (const auth of attempts) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: auth, accept: '*/*' },
      });
      const raw = await res.text();
      let data = null;
      try {
        data = JSON.parse(raw);
      } catch {
        data = raw;
      }
      if (res.ok && !(data && data.result === false)) {
        return { sent: true, data };
      }
      last = { sent: false, status: res.status, data: String(raw).slice(0, 200) };
      console.error('WATI send failed', res.status, String(raw).slice(0, 200));
      if (res.status !== 401 && res.status !== 403) break;
    } catch (e) {
      last = { sent: false, error: String(e) };
      console.error('WATI send error', String(e), '| base=', base);
      break;
    }
  }
  return last || { sent: false };
}

export async function GET() {
  return NextResponse.json({
    status: 'online',
    message: 'LikeNew Feedback Request API is running.',
    secret_configured: Boolean(process.env.FEEDBACK_API_SECRET),
    wati_configured: Boolean(process.env.WATI_API_ENDPOINT && process.env.WATI_API_TOKEN),
  });
}

export async function POST(request) {
  try {
    const secret = process.env.FEEDBACK_API_SECRET;
    const url = new URL(request.url);
    const givenSecret = url.searchParams.get('secret') || request.headers.get('x-api-secret');
    if (!secret || givenSecret !== secret) {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const waId = String(body.waId || '').trim();
    const orderId = String(body.orderId || '').trim().toUpperCase();
    const lang = body.lang === 'en' ? 'en' : 'so';

    if (!waId || !orderId) {
      return NextResponse.json({ ok: false, error: 'MISSING_FIELDS' }, { status: 400 });
    }

    await prisma.botSession.upsert({
      where: { waId },
      create: { waId, awaiting: `FEEDBACK:${orderId}` },
      update: { awaiting: `FEEDBACK:${orderId}` },
    });

    const sendRes = await sendWatiMessage(waId, FEEDBACK_REQUEST[lang](orderId));

    return NextResponse.json({ ok: true, sent: sendRes.sent, ...(sendRes.sent ? {} : { debug: sendRes }) });
  } catch (error) {
    console.error('send-feedback crash:', error);
    return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
