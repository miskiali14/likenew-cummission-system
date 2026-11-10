import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Public, unauthenticated intake for job applications submitted from the
// careers form on the website (separate project, likenew-web). No login
// exists for applicants, so this is the only way a filled-in form reaches
// this table. CORS is open since the form lives on its own separate site.
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
    const {
      role,
      fullName,
      phone,
      email,
      location,
      educationLevel,
      yearsExperience,
      lastTitle,
      lastCompany,
      ledTeam,
      teamSize,
      portfolioLinks,
      cvLink,
      aiTools,
      thirtyDayPlan,
      whyFit,
    } = body;

    const required = { role, fullName, phone, email, location, educationLevel, yearsExperience, cvLink, thirtyDayPlan, whyFit };
    for (const [key, value] of Object.entries(required)) {
      if (!String(value || '').trim()) {
        return NextResponse.json(
          { message: `${key} is required` },
          { status: 400, headers: CORS_HEADERS }
        );
      }
    }

    const application = await prisma.jobApplication.create({
      data: {
        role: String(role).trim(),
        fullName: String(fullName).trim(),
        phone: String(phone).trim(),
        email: String(email).trim(),
        location: String(location).trim(),
        educationLevel: String(educationLevel).trim(),
        yearsExperience: String(yearsExperience).trim(),
        lastTitle: lastTitle ? String(lastTitle).trim() : null,
        lastCompany: lastCompany ? String(lastCompany).trim() : null,
        ledTeam: Boolean(ledTeam),
        teamSize: teamSize ? String(teamSize).trim() : null,
        portfolioLinks: portfolioLinks ? String(portfolioLinks).trim() : null,
        cvLink: String(cvLink).trim(),
        aiTools: Array.isArray(aiTools) ? aiTools.map(String) : [],
        thirtyDayPlan: String(thirtyDayPlan).trim(),
        whyFit: String(whyFit).trim(),
      },
    });

    return NextResponse.json({ id: application.id }, { status: 201, headers: CORS_HEADERS });
  } catch (error) {
    return NextResponse.json(
      { message: 'A server error occurred', error: error.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
