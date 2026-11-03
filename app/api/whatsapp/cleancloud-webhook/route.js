import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/*
 * LikeNew — CleanCloud Webhook (order status changed)
 * Method: POST
 *
 * Ku dar URL-kan CleanCloud dashboard-ka qaybta Webhooks/Integrations:
 *   https://www.haadlinks.com/api/whatsapp/cleancloud-webhook?secret=<FEEDBACK_API_SECRET>
 *
 * Marka order-ku isbeddelo ilaa "Completed", si toos ah ayuu macmiilka
 * WhatsApp ugu diraa weydiinta feedback-ka (1-5).
 *
 * MUHIIM: Ma la hubo qaabka exact-ka ah ee payload-ka CleanCloud (field
 * names). Handler-kan wuxuu isku dayaa dhowr magac oo caadi ah, oo wuxuu
 * duubaa (log) payload-ka buuxa si Vercel logs looga eego qaabka dhabta
 * ah — haddii aanu si sax ah u fasirin, ka eeg logs-ka oo wax ka beddel.
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

// Magacyo kala duwan oo CleanCloud ay u isticmaali karto status-ka "dhammaaday"
const COMPLETED_HINTS = ['2', 'completed', 'complete', 'ready to deliver', 'picked up', 'delivered'];

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

// Qaab-dhiska fiiro gaar ah: isku day dhowr magac oo field ah, maadaama
// aanan hubin qaabka exact-ka ah ee CleanCloud.
function extractField(body, names) {
  for (const n of names) {
    const v = body?.[n];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return null;
}

function normalizeOrderId(rawOrderId, branchHint) {
  let id = String(rawOrderId || '').trim().toUpperCase();
  if (/^(HQ|KM5)-\d+$/.test(id)) return id;
  const digitsOnly = id.replace(/[^\d]/g, '');
  if (!digitsOnly) return null;
  const hint = String(branchHint || '').toLowerCase();
  const isHQ = hint.includes('hq') || hint.includes('waaberi');
  const isKM5 = hint.includes('km') || hint.includes('hodan');
  if (isHQ) return `HQ-${digitsOnly}`;
  if (isKM5) return `KM5-${digitsOnly}`;
  return null;
}

export async function GET() {
  return NextResponse.json({
    status: 'online',
    message: 'LikeNew CleanCloud Webhook is running.',
    secret_configured: Boolean(process.env.FEEDBACK_API_SECRET),
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
    console.log('[cleancloud-webhook] incoming:', JSON.stringify(body).slice(0, 1000));

    const status = extractField(body, ['status', 'orderStatus', 'newStatus', 'status_code', 'statusName']);
    const statusLower = String(status || '').trim().toLowerCase();
    const isCompleted = COMPLETED_HINTS.includes(statusLower);
    if (!isCompleted) {
      return NextResponse.json({ ok: true, ignored: true, reason: 'not_completed', status });
    }

    const rawOrderId = extractField(body, ['orderID', 'order_id', 'orderId', 'id']);
    const branchHint = extractField(body, ['branch', 'branchName', 'locationName', 'storeName', 'location']);
    const orderId = normalizeOrderId(rawOrderId, branchHint);
    const phone = extractField(body, ['customerPhone', 'customer_phone', 'phone', 'mobile', 'waId', 'cellPhone']);

    if (!orderId || !phone) {
      console.error('[cleancloud-webhook] missing orderId/phone after extraction', { rawOrderId, branchHint, phone });
      return NextResponse.json({ ok: false, error: 'COULD_NOT_EXTRACT', rawOrderId, branchHint, phone }, { status: 200 });
    }

    // Ka hortag dirista laba jeer isla order-kaas — BotSession-ka database-ka.
    const dedupKey = `fbsent:${orderId}`;
    const existing = await prisma.botSession.findUnique({ where: { waId: dedupKey } });
    if (existing && existing.awaiting === 'SENT') {
      return NextResponse.json({ ok: true, ignored: true, reason: 'already_sent', orderId });
    }
    await prisma.botSession.upsert({
      where: { waId: dedupKey },
      create: { waId: dedupKey, awaiting: 'SENT' },
      update: { awaiting: 'SENT' },
    });

    const waId = String(phone).replace(/\D/g, '');
    await prisma.botSession.upsert({
      where: { waId },
      create: { waId, awaiting: `FEEDBACK:${orderId}` },
      update: { awaiting: `FEEDBACK:${orderId}` },
    });
    const sendRes = await sendWatiMessage(waId, FEEDBACK_REQUEST.so(orderId));

    return NextResponse.json({ ok: true, orderId, waId, sent: sendRes.sent, ...(sendRes.sent ? {} : { debug: sendRes }) });
  } catch (error) {
    console.error('cleancloud-webhook crash:', error);
    return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
