import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';

// Verifies the Bearer token on a Request and (optionally) checks the user's
// role. Returns { user } on success, or { response } with the exact
// error/status to return immediately when auth fails.
export function requireAuth(request, allowedRoles) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      response: NextResponse.json(
        { message: 'You are not logged in (Token is missing)' },
        { status: 401 }
      ),
    };
  }

  const token = authHeader.split(' ')[1];
  let user;
  try {
    user = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey');
  } catch {
    return {
      response: NextResponse.json(
        { message: 'Token is invalid or has expired' },
        { status: 403 }
      ),
    };
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return {
      response: NextResponse.json(
        { message: 'You do not have permission to access this' },
        { status: 403 }
      ),
    };
  }

  return { user };
}
