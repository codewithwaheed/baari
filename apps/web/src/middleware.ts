import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('baari_token');
  const { pathname } = request.nextUrl;

  // Redirect authenticated users away from auth pages
  if (token && (pathname.startsWith('/login') || pathname.startsWith('/signup'))) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Redirect unauthenticated users away from protected pages
  if (!token && (pathname.startsWith('/dashboard') || pathname.startsWith('/onboarding'))) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard',
    '/dashboard/:path*',
    '/onboarding',
    '/onboarding/:path*',
    '/login',
    '/login/:path*',
    '/signup',
    '/signup/:path*',
  ],
};
