import { NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';

/*
 * LikeNew — CleanCloud sync (polling)
 * Method: GET
 *
 * CleanCloud's own webhook push turned out to be unreliable (never
 * confirmed firing), and Vercel's Hobby cron only runs once a day — so an
 * external scheduler (GitHub Actions) calls this endpoint every 15-30 min
 * instead. For every order that's reached Completed since the last run:
 *   1) sends the customer a WhatsApp feedback request (1-5), same as the
 *      webhook-based flow would have.
 *   2) registers the customer in bilyeeti if they don't have a card yet
 *      (idempotent — returns the existing card otherwise), then mirrors
 *      CleanCloud's own loyaltyPointsAvailable balance into bilyeeti (not
 *      an amount-based credit off the order total) by posting the delta
 *      as a signed "sale" event. Registering first matters: an event for
 *      a phone bilyeeti doesn't know yet is silently "ignored", not an
 *      error, so points would otherwise be lost with no sign of failure.
 * Both are best-effort per order — one failing doesn't stop the rest.
 *
 * Auth: ?secret=<FEEDBACK_API_SECRET>
 * Query: ?windowSeconds=1800 (optional, default 1800 = 30 min lookback —
 *   should comfortably cover the gap between two runs plus some slack)
 */

const CLEANCLOUD_API = 'https://cleancloudapp.com/api';
const BILYEETI_EVENTS_URL = 'https://bilyeeti.so/api/public/pos/v1/events';
const BILYEETI_REGISTER_URL = 'https://bilyeeti.so/api/method/bilyeeti_backend.api.pos_ingest.customers';
// bilyeeti's docs mark `program` optional "when the connection has a
// default program" — in practice every request without it failed (register:
// 401 invalid_signature, credit: 404 DoesNotExistError), so the connection
// has no default and this must be sent explicitly. From the Likenew Rewards
// program's dashboard URL (bilyeeti.so/dashboard/programs/bs6s564ojn).
const BILYEETI_PROGRAM_ID = 'bs6s564ojn';
const COMPLETED_STATUS = '2';

const FEEDBACK_REQUEST = {
  so: (orderId) =>
    `Mahadsanid! Dalabkaaga *${orderId}* waa la dhammeeyay.\n\n` +
    'Sideed u qiimeeyaysaa adeeggan? Jawaab hal number 1-5.\n' +
    '(1 = aad u xun, 5 = aad u fiican)',
  newCard: (cardUrl) =>
    'Waxaan kuu diyaarinay kaarkaaga Likenew Rewards! ' +
    'Dhibcihii aad horey ugu heshay waa lagu daray.\n\n' +
    `Halkan ka daawo: ${cardUrl}`,
};

async function sendWatiMessage(waId, text) {
  const endpoint = process.env.WATI_API_ENDPOINT;
  const token = process.env.WATI_API_TOKEN;
  if (!endpoint || !token) {
    console.error('WATI_API_ENDPOINT / WATI_API_TOKEN not configured');
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
      const res = await fetch(url, { method: 'POST', headers: { Authorization: auth, accept: '*/*' } });
      const raw = await res.text();
      let data = null;
      try { data = JSON.parse(raw); } catch { data = raw; }
      if (res.ok && !(data && data.result === false)) return { sent: true, data };
      last = { sent: false, status: res.status, data: String(raw).slice(0, 200) };
      if (res.status !== 401 && res.status !== 403) break;
    } catch (e) {
      last = { sent: false, error: String(e) };
      break;
    }
  }
  return last || { sent: false };
}

// Atomic once-only claim, same pattern as /api/public/bot-session's
// "claim" action — relies on the waId primary key's unique constraint so a
// re-run within the lookback window never double-processes an order.
async function claimOnce(key) {
  try {
    await prisma.botSession.create({ data: { waId: key, awaiting: 'SYNCED' } });
    return true;
  } catch (error) {
    if (error.code === 'P2002') return false;
    throw error;
  }
}

async function cleanCloudCall(path, body) {
  const res = await fetch(`${CLEANCLOUD_API}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json().catch(() => null);
}

function signBilyeetiEvent(secret, timestamp, rawBody) {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
}

// bilyeeti has no "set absolute balance" call — a Points program only
// accrues via the "amount" on a "sale" event (rate configured in bilyeeti).
// CleanCloud already has its own authoritative, non-currency loyaltyPoints
// balance per customer, so the only way to make bilyeeti's total match it
// is: configure the bilyeeti program's rate at 1 point per 1 unit of
// "amount", then send the delta in CleanCloud's points balance as "amount"
// each time it moves. A unique idempotency_key per delta keeps re-runs safe.
async function sendBilyeetiPointsDelta({ customerID, deltaPoints, phoneE164 }) {
  const key = process.env.BILYEETI_API_KEY;
  const secret = process.env.BILYEETI_API_SECRET;
  if (!key || !secret) return { sent: false, reason: 'not_configured' };

  const ts = Math.floor(Date.now() / 1000).toString();
  const body = JSON.stringify({
    event: 'sale',
    idempotency_key: `cc-loyalty-${customerID}-${ts}`,
    external_id: String(customerID),
    amount: Number(deltaPoints),
    phone: phoneE164,
    program: BILYEETI_PROGRAM_ID,
  });
  const sig = signBilyeetiEvent(secret, ts, body);

  try {
    const res = await fetch(BILYEETI_EVENTS_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-loyal-key': key,
        'x-loyal-timestamp': ts,
        'x-loyal-signature': sig,
      },
      body,
    });
    const data = await res.json().catch(() => null);
    return { sent: res.ok, status: res.status, data };
  } catch (e) {
    return { sent: false, error: String(e) };
  }
}

// Ensures the customer has a bilyeeti card before we try to credit them —
// a "sale" event for a phone bilyeeti doesn't recognize yet is silently
// "ignored" (per bilyeeti's docs), not an error, so points would be lost
// with no sign anything went wrong. Idempotent: if the customer already has
// a card in the program, bilyeeti just returns it — nothing new is made.
async function registerBilyeetiCustomer({ phoneE164, firstName }) {
  const key = process.env.BILYEETI_API_KEY;
  const secret = process.env.BILYEETI_API_SECRET;
  if (!key || !secret) return { ok: false, reason: 'not_configured' };

  const ts = Math.floor(Date.now() / 1000).toString();
  const body = JSON.stringify({
    program: BILYEETI_PROGRAM_ID,
    phone: phoneE164,
    first_name: firstName || 'Customer',
    notify: false,
  });
  const sig = signBilyeetiEvent(secret, ts, body);

  try {
    const res = await fetch(BILYEETI_REGISTER_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-loyal-key': key,
        'x-loyal-timestamp': ts,
        'x-loyal-signature': sig,
      },
      body,
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function GET(request) {
  const secret = process.env.FEEDBACK_API_SECRET;
  const url = new URL(request.url);
  const givenSecret = url.searchParams.get('secret') || request.headers.get('x-api-secret');
  if (!secret || givenSecret !== secret) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const cleanCloudToken = process.env.CLEANCLOUD_API_TOKEN;
  if (!cleanCloudToken) {
    return NextResponse.json({ ok: false, error: 'CLEANCLOUD_API_TOKEN not configured' }, { status: 500 });
  }

  const windowSeconds = Number(url.searchParams.get('windowSeconds')) || 1800;

  let ordersData;
  try {
    ordersData = await cleanCloudCall('getOrders', {
      api_token: cleanCloudToken,
      completed: 1,
      updatedSecondsAgoFrom: windowSeconds,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'CLEANCLOUD_FETCH_FAILED', detail: String(e) }, { status: 502 });
  }

  const orders = Array.isArray(ordersData?.Orders) ? ordersData.Orders : [];
  const results = [];

  for (const order of orders) {
    if (String(order.status) !== COMPLETED_STATUS) continue;

    const dedupKey = `cc:${order.id}`;
    const claimed = await claimOnce(dedupKey);
    if (!claimed) {
      results.push({ orderId: order.id, skipped: 'already_processed' });
      continue;
    }

    let customer;
    try {
      customer = await cleanCloudCall('getCustomer', { api_token: cleanCloudToken, customerID: order.customerID });
    } catch (e) {
      results.push({ orderId: order.id, skipped: 'customer_lookup_failed', detail: String(e) });
      continue;
    }

    const tel = customer?.Tel;
    if (!tel) {
      results.push({ orderId: order.id, skipped: 'no_phone' });
      continue;
    }
    const waId = '252' + String(tel).replace(/\D/g, '').slice(-9);
    const phoneE164 = `+${waId}`;

    // 1) WhatsApp feedback request — mark the session so the bot knows the
    // customer's next 1-5 reply is a rating for this order.
    await prisma.botSession.upsert({
      where: { waId },
      create: { waId, awaiting: `FEEDBACK:${order.id}` },
      update: { awaiting: `FEEDBACK:${order.id}` },
    });
    const feedbackSend = await sendWatiMessage(waId, FEEDBACK_REQUEST.so(order.id));

    // 2) bilyeeti loyalty — make sure the customer has a card (register is
    // idempotent: returns the existing one if they already have it), then
    // mirror CleanCloud's own loyaltyPointsAvailable balance as a delta —
    // not the order amount. Best-effort either way.
    const firstName = String(customer?.Name || '').trim().split(/\s+/)[0] || 'Customer';
    const registerResult = await registerBilyeetiCustomer({ phoneE164, firstName });
    const newCard = registerResult.ok && registerResult.data?.created === true;
    if (newCard && registerResult.data?.card?.card_url) {
      await sendWatiMessage(waId, FEEDBACK_REQUEST.newCard(registerResult.data.card.card_url));
    }

    const currentPoints = Number(customer?.loyaltyPointsAvailable) || 0;
    const known = await prisma.cleanCloudLoyalty.findUnique({ where: { customerID: String(order.customerID) } });
    const lastKnown = known?.points ?? 0;
    const deltaPoints = currentPoints - lastKnown;

    let bilyeetiResult = { sent: false, reason: 'no_change' };
    if (deltaPoints > 0) {
      bilyeetiResult = await sendBilyeetiPointsDelta({
        customerID: order.customerID,
        deltaPoints,
        phoneE164,
      });
      if (bilyeetiResult.sent) {
        await prisma.cleanCloudLoyalty.upsert({
          where: { customerID: String(order.customerID) },
          create: { customerID: String(order.customerID), points: currentPoints },
          update: { points: currentPoints },
        });
      }
    }

    results.push({
      orderId: order.id,
      waId,
      currentPoints,
      deltaPoints,
      feedbackSent: feedbackSend.sent,
      registered: registerResult.ok,
      newCard,
      bilyeetiSent: bilyeetiResult.sent,
    });
  }

  return NextResponse.json({ ok: true, windowSeconds, fetched: orders.length, processed: results.length, results });
}
