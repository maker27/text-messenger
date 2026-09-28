import { type NextRequest, NextResponse } from 'next/server';

const CSP_HEADER = 'Content-Security-Policy';

function createContentSecurityPolicy(nonce: string) {
  const scriptSources = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];

  if (process.env.NODE_ENV === 'development') {
    scriptSources.push("'unsafe-eval'");
  }

  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}

export function proxy(request: NextRequest) {
  const policy = createContentSecurityPolicy(btoa(crypto.randomUUID()));
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CSP_HEADER, policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(CSP_HEADER, policy);
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('X-Content-Type-Options', 'nosniff');

  return response;
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico|apple-icon.png).*)',
};
