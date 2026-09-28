import { expect, test } from 'vitest';

import { createUnreadFaviconHref } from './unread-favicon';

const SVG_DATA_URI_PREFIX = 'data:image/svg+xml,';

function readSvg(href: string) {
  expect(href.startsWith(SVG_DATA_URI_PREFIX)).toBe(true);
  return decodeURIComponent(href.slice(SVG_DATA_URI_PREFIX.length));
}

test('draws the unread count on the icon', () => {
  expect(readSvg(createUnreadFaviconHref(5))).toContain('>5</text>');
});

test('caps a large count at 99+', () => {
  expect(readSvg(createUnreadFaviconHref(150))).toContain('>99+</text>');
});

test('keeps the count of exactly 99', () => {
  expect(readSvg(createUnreadFaviconHref(99))).toContain('>99</text>');
});

test('encodes the svg for a url', () => {
  expect(createUnreadFaviconHref(5)).not.toMatch(/[<>#"]/);
});
