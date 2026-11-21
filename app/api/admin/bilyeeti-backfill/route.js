import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';

/*
 * One-time, admin-triggered backfill: for every customer CleanCloud already
 * has a loyaltyPointsAvailable balance for, register them in bilyeeti (if
 * they don't have a card yet) and credit the delta vs what we last sent —
 * exactly what the regular 15-min sync-cleancloud cron does per completed
 * order, just walked across the whole existing customer list once so
 * historical balances show up immediately instead of waiting for each
 * customer's next order.
 *
 * Deliberately NOT a cron: this fires hundreds of real credits to real
 * bilyeeti customers, so it only runs when an admin clicks the button in
 * the dashboard — never on a schedule, never automatically.
 *
 * Called repeatedly by the dashboard page with an increasing `offset`
 * until `done: true`, to stay well under any serverless time limit per
 * request (CleanCloud is rate-limited to 3 req/sec, so each customer check
 * takes real time).
 */

export const maxDuration = 60;

const CLEANCLOUD_API = 'https://cleancloudapp.com/api';
const BILYEETI_EVENTS_URL = 'https://bilyeeti.so/api/public/pos/v1/events';
const BILYEETI_REGISTER_URL = 'https://bilyeeti.so/api/method/bilyeeti_backend.api.pos_ingest.customers';
// bilyeeti's docs mark `program` optional "when the connection has a
// default program" — in practice every request without it failed (register:
// 401 invalid_signature, credit: 404 DoesNotExistError), so the connection
// has no default and this must be sent explicitly. From the Likenew Rewards
// program's dashboard URL (bilyeeti.so/dashboard/programs/bs6s564ojn).
const BILYEETI_PROGRAM_ID = 'bs6s564ojn';
const BATCH_SIZE = 25;

async function cleanCloudCall(path, body) {
  const res = await fetch(`${CLEANCLOUD_API}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json().catch(() => null);
}

function sign(secret, ts, rawBody) {
  return crypto.createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex');
}

async function bilyeetiPost(url, key, secret, payload) {
  const ts = Math.floor(Date.now() / 1000).toString();
  const body = JSON.stringify(payload);
  const sig = sign(secret, ts, body);
  try {
    const res = await fetch(url, {
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST(request) {
  const auth = requireAuth(request, ['ADMIN']);
  if (auth.response) return auth.response;

  const cleanCloudToken = process.env.CLEANCLOUD_API_TOKEN;
  const bilyeetiKey = process.env.BILYEETI_API_KEY;
  const bilyeetiSecret = process.env.BILYEETI_API_SECRET;
  if (!cleanCloudToken || !bilyeetiKey || !bilyeetiSecret) {
    return NextResponse.json({ ok: false, error: 'MISSING_ENV_VARS' }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const offset = Number(body.offset) || 0;

  const total = await prisma.cleanCloudCustomerIndex.count();
  const chunk = await prisma.cleanCloudCustomerIndex.findMany({
    orderBy: { phone: 'asc' },
    skip: offset,
    take: BATCH_SIZE,
  });

  const results = [];
  let creditedCount = 0;
  let registeredCount = 0;
  let totalPointsSent = 0;
  let errorCount = 0;

  for (const row of chunk) {
    const phoneE164 = `+${row.phone}`;
    try {
      const customer = await cleanCloudCall('getCustomer', { api_token: cleanCloudToken, customerID: row.customerID });
      const currentPoints = Number(customer?.loyaltyPointsAvailable) || 0;

      if (currentPoints <= 0) {
        results.push({ customerID: row.customerID, skipped: 'no_points' });
        await sleep(350);
        continue;
      }

      const firstName = String(customer?.Name || row.name || '').trim().split(/\s+/)[0] || 'Customer';
      const regResult = await bilyeetiPost(BILYEETI_REGISTER_URL, bilyeetiKey, bilyeetiSecret, {
        program: BILYEETI_PROGRAM_ID,
        phone: phoneE164,
        first_name: firstName,
        notify: false,
      });
      if (regResult.ok) {
        registeredCount++;
      } else {
        console.error('bilyeeti register failed', row.customerID, regResult.status, JSON.stringify(regResult.data || regResult.error));
      }

      const known = await prisma.cleanCloudLoyalty.findUnique({ where: { customerID: row.customerID } });
      const lastKnown = known?.points ?? 0;
      const delta = currentPoints - lastKnown;

      if (delta > 0) {
        const creditResult = await bilyeetiPost(BILYEETI_EVENTS_URL, bilyeetiKey, bilyeetiSecret, {
          event: 'sale',
          idempotency_key: `cc-loyalty-backfill-${row.customerID}-${Date.now()}`,
          external_id: row.customerID,
          amount: delta,
          phone: phoneE164,
          program: BILYEETI_PROGRAM_ID,
        });
        if (creditResult.ok) {
          await prisma.cleanCloudLoyalty.upsert({
            where: { customerID: row.customerID },
            create: { customerID: row.customerID, points: currentPoints },
            update: { points: currentPoints },
          });
          creditedCount++;
          totalPointsSent += delta;
          results.push({ customerID: row.customerID, credited: delta });
        } else {
          errorCount++;
          console.error('bilyeeti credit failed', row.customerID, creditResult.status, JSON.stringify(creditResult.data || creditResult.error));
          results.push({ customerID: row.customerID, error: 'credit_failed', detail: creditResult.data || creditResult.error });
        }
      } else {
        results.push({ customerID: row.customerID, skipped: 'no_delta' });
      }
    } catch (e) {
      errorCount++;
      results.push({ customerID: row.customerID, error: String(e) });
    }
    await sleep(350); // stay under CleanCloud's 3 req/sec
  }

  const nextOffset = offset + chunk.length;
  const done = nextOffset >= total;

  return NextResponse.json({
    ok: true,
    offset,
    nextOffset,
    total,
    done,
    batch: { size: chunk.length, registeredCount, creditedCount, totalPointsSent, errorCount },
    results,
  });
}
