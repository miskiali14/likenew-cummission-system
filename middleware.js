import { NextResponse } from 'next/server';

// When this app is reached through a domain listed in PUBLIC_SEARCH_DOMAINS
// (comma-separated, set in Vercel's env vars), the root path shows the
// customer-facing "find my item" search page directly instead of the staff
// login screen — so that domain can be handed to customers on its own.
const PUBLIC_DOMAINS = (process.env.PUBLIC_SEARCH_DOMAINS || '')
  .split(',')
  .map((d) => d.trim())
  .filter(Boolean);

export function middleware(request) {
  if (PUBLIC_DOMAINS.length === 0) return NextResponse.next();

  const host = request.headers.get('host') || '';
  const hostname = host.split(':')[0];

  if (PUBLIC_DOMAINS.includes(hostname) && request.nextUrl.pathname === '/') {
    return NextResponse.rewrite(new URL('/find-my-item', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/',
};
