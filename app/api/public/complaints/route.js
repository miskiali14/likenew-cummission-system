import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { todayStr } from '@/lib/date';

// Public, unauthenticated intake for complaints filed from outside the app —
// currently the WhatsApp order-tracking bot. No login exists for customers,
// so this is the only way a complaint they type themselves reaches the same
// Complaints table staff manage. CORS is open since the bot lives on its own
// separate site/project.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { description, phone, orderId, branch, customerName } = body;

    const text = String(description || '').trim();
    if (text.length < 5) {
      return NextResponse.json(
        { message: 'Please describe the complaint in a bit more detail' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const complaint = await prisma.complaint.create({
      data: {
        branch: branch === 'KM5' ? 'KM5' : 'HQ',
        customerName: (customerName && String(customerName).trim()) || 'WhatsApp Customer',
        phone: phone ? String(phone).trim() : null,
        orderId: orderId ? String(orderId).trim() : null,
        category: 'OTHER',
        description: text,
        date: todayStr(),
        loggedByName: 'WhatsApp Bot',
      },
    });

    return NextResponse.json({ id: complaint.id }, { status: 201, headers: CORS_HEADERS });
  } catch (error) {
    return NextResponse.json(
      { message: 'A server error occurred', error: error.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
