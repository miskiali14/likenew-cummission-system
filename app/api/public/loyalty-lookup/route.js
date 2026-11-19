import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/*
 * Public, read-only lookup: a customer enters their phone number and sees
 * their current CleanCloud loyaltyPointsAvailable. Nothing is written to
 * CleanCloud or bilyeeti here — this never sends or credits anything, it
 * only displays what CleanCloud already has.
 *
 * Method: GET
 * Query: ?phone=<any format, normalized below>
 */

const CLEANCLOUD_API = 'https://cleancloudapp.com/api';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS_HEADERS });
}

async function cleanCloudCall(path, body) {
  const res = await fetch(`${CLEANCLOUD_API}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json().catch(() => null);
}

export async function GET(request) {
  const url = new URL(request.url);
  const rawPhone = url.searchParams.get('phone') || '';
  const digits = rawPhone.replace(/\D/g, '').slice(-9);
  if (digits.length < 7) {
    return NextResponse.json({ ok: false, error: 'INVALID_PHONE' }, { status: 400, headers: CORS_HEADERS });
  }
  const phone = '252' + digits;

  const indexed = await prisma.cleanCloudCustomerIndex.findUnique({ where: { phone } });
  if (!indexed) {
    return NextResponse.json({ ok: true, found: false }, { headers: CORS_HEADERS });
  }

  const cleanCloudToken = process.env.CLEANCLOUD_API_TOKEN;
  if (!cleanCloudToken) {
    return NextResponse.json({ ok: false, error: 'CLEANCLOUD_API_TOKEN not configured' }, { status: 500, headers: CORS_HEADERS });
  }

  const customer = await cleanCloudCall('getCustomer', { api_token: cleanCloudToken, customerID: indexed.customerID });
  const points = Number(customer?.loyaltyPointsAvailable) || 0;
  const name = customer?.Name || indexed.name || null;

  return NextResponse.json({ ok: true, found: true, name, points }, { headers: CORS_HEADERS });
}
