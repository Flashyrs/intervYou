import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Only redirect to HTTPS in production
  if (process.env.NODE_ENV === 'production' && request.headers.get("x-forwarded-proto") === "http") {
    const url = request.nextUrl;
    url.protocol = "https:";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/:path*'],
};
