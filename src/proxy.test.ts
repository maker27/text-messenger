import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { NextRequest } from 'next/server';
import { expect, test } from 'vitest';

import { config, proxy } from './proxy';

const PAGE_URL = 'http://localhost:3000/max';
const NONCE_PATTERN = /'nonce-([^']+)'/;
const REQUEST_CSP_HEADER = 'x-middleware-request-content-security-policy';

function getNonce(policy: string | null) {
  return policy?.match(NONCE_PATTERN)?.[1];
}

test('sets the security headers on the response', () => {
  const response = proxy(new NextRequest(PAGE_URL));

  expect(response.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
  expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
  expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
});

test('passes the same nonce to the render through the request policy', () => {
  const response = proxy(new NextRequest(PAGE_URL));
  const nonce = getNonce(response.headers.get('Content-Security-Policy'));

  expect(nonce).toBeTruthy();
  expect(getNonce(response.headers.get(REQUEST_CSP_HEADER))).toBe(nonce);
});

test('generates a new nonce for every request', () => {
  const firstPolicy = proxy(new NextRequest(PAGE_URL)).headers.get('Content-Security-Policy');
  const secondPolicy = proxy(new NextRequest(PAGE_URL)).headers.get('Content-Security-Policy');

  expect(getNonce(firstPolicy)).not.toBe(getNonce(secondPolicy));
});

test.each(['/max', '/telegram/79161234567', '/privacy', '/api/max/events'])(
  'runs for %s',
  (path) => {
    expect(unstable_doesMiddlewareMatch({ config, url: path })).toBe(true);
  },
);

test.each(['/_next/static/chunks/app.js', '/_next/image', '/favicon.ico', '/apple-icon.png'])(
  'skips the static asset %s',
  (path) => {
    expect(unstable_doesMiddlewareMatch({ config, url: path })).toBe(false);
  },
);
