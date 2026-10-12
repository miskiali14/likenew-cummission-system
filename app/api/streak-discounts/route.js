import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { todayStr } from '@/lib/date';

// Phones get typed inconsistently (spaces, dashes, +252 vs 0, a stray wrong
// country code) — compare the last 9 digits so the duplicate check isn't
// fooled by formatting differences.
const normalizePhone = (phone) => String(phone || '').replace(/\D/g, '').slice(-9);

const ALLOWED_ROLES = ['ADMIN', 'SALES'];

// Snapchat streak discount claims — logged when a customer presents a
// 30-day streak, blocked from claiming again until 30 days after their
// last claim (by then they've plausibly built a fresh streak).
export async function GET(request) {
  const auth = requireAuth(request, ALLOWED_ROLES);
  if (auth.response) return auth.response;
  const user = auth.user;

  try {
    const { searchParams } = new URL(request.url);
    const branchParam = searchParams.get('branch');

    const whereClause = {};
    if (user.role === 'ADMIN') {
      if (branchParam && branchParam !== 'All') whereClause.branch = branchParam;
    } else {
      whereClause.branch = user.branch;
    }

    const claims = await prisma.streakDiscount.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(claims);
  } catch (error) {
    return NextResponse.json({ message: 'A server error occurred', error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = requireAuth(request, ALLOWED_ROLES);
  if (auth.response) return auth.response;
  const user = auth.user;

  try {
    const body = await request.json();
    const { customerName, phone, date } = body;

    if (!customerName || !phone) {
      return NextResponse.json(
        { message: 'Please fill in the customer name and phone number' },
        { status: 400 }
      );
    }

    const normalized = normalizePhone(phone);
    if (normalized.length < 7) {
      return NextResponse.json({ message: 'Please enter a valid phone number' }, { status: 400 });
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    // Pull recent claims and compare normalized phones in JS — phone isn't
    // stored in a single consistent format, so a DB-level exact match isn't
    // reliable.
    const recentClaims = await prisma.streakDiscount.findMany({
      where: { date: { gte: cutoffStr } },
      orderBy: { date: 'desc' },
    });
    const existingClaim = recentClaims.find((c) => normalizePhone(c.phone) === normalized);

    if (existingClaim) {
      const claimDate = new Date(`${existingClaim.date}T00:00:00.000Z`);
      const eligibleAgain = new Date(claimDate);
      eligibleAgain.setDate(eligibleAgain.getDate() + 30);
      return NextResponse.json(
        {
          message: `This customer already claimed the streak discount on ${existingClaim.date} (as ${existingClaim.customerName}). They can claim again starting ${eligibleAgain.toISOString().split('T')[0]}.`,
        },
        { status: 409 }
      );
    }

    const claim = await prisma.streakDiscount.create({
      data: {
        branch: body.branch || user.branch || 'HQ',
        customerName,
        phone,
        date: date || todayStr(),
        createdById: user.id,
        createdByName: user.fullName,
      },
    });

    return NextResponse.json(claim, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to save streak discount claim', error: error.message }, { status: 500 });
  }
}
