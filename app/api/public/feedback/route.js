import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Public, unauthenticated intake for post-order satisfaction ratings —
// currently the WhatsApp order-tracking bot (separate project, likenew-web).
// No login exists for customers, so this is the only way a 1-5 rating they
// reply with reaches this table. CORS is open since the bot lives on its own
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
    const { orderId, phone, rating, branch } = body;

    const orderIdStr = String(orderId || '').trim();
    const ratingNum = Number(rating);
    if (!orderIdStr || !Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return NextResponse.json(
        { message: 'orderId and an integer rating (1-5) are required' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const feedback = await prisma.feedback.create({
      data: {
        branch: branch === 'KM5' ? 'KM5' : branch === 'HQ' ? 'HQ' : null,
        orderId: orderIdStr,
        phone: phone ? String(phone).trim() : '',
        rating: ratingNum,
      },
    });

    return NextResponse.json({ id: feedback.id }, { status: 201, headers: CORS_HEADERS });
  } catch (error) {
    return NextResponse.json(
      { message: 'A server error occurred', error: error.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
