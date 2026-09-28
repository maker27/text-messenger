import { render } from '@testing-library/react';
import { beforeEach, expect, test } from 'vitest';

import type { MessengerId } from '@/entities/messenger/model';

import { UnreadIndicators } from './unread-indicators';

const ORIGINAL_TITLE = 'Multi Messenger';
const ORIGINAL_ICON_HREF = '/favicon.ico?favicon.0b3bf435.ico';
const ORIGINAL_ICON_TYPE = 'image/x-icon';
const NO_UNREAD: Record<MessengerId, number> = { max: 0, telegram: 0, whatsapp: 0 };
const SOME_UNREAD: Record<MessengerId, number> = { max: 2, telegram: 1, whatsapp: 3 };

function getIcon() {
  const icon = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (icon === null) {
    throw new Error('The icon link is missing');
  }
  return icon;
}

beforeEach(() => {
  document.head.innerHTML = `<link rel="icon" href="${ORIGINAL_ICON_HREF}" type="${ORIGINAL_ICON_TYPE}">`;
  document.title = ORIGINAL_TITLE;
});

test('shows the unread total of all messengers', () => {
  render(<UnreadIndicators unreadByMessenger={SOME_UNREAD} />);

  expect(document.title).toBe('(6) Multi Messenger');
  expect(getIcon().getAttribute('href')).toMatch(/^data:image\/svg\+xml,.*%3E6%3C/);
  expect(getIcon().type).toBe('image/svg+xml');
});

test('leaves the title and icon alone without unread messages', () => {
  render(<UnreadIndicators unreadByMessenger={NO_UNREAD} />);

  expect(document.title).toBe(ORIGINAL_TITLE);
  expect(getIcon().getAttribute('href')).toBe(ORIGINAL_ICON_HREF);
});

test('restores the title and icon once everything is read', () => {
  const { rerender } = render(<UnreadIndicators unreadByMessenger={SOME_UNREAD} />);

  rerender(<UnreadIndicators unreadByMessenger={{ ...SOME_UNREAD, max: 5 }} />);
  expect(document.title).toBe('(9) Multi Messenger');
  rerender(<UnreadIndicators unreadByMessenger={NO_UNREAD} />);

  expect(document.title).toBe(ORIGINAL_TITLE);
  expect(getIcon().getAttribute('href')).toBe(ORIGINAL_ICON_HREF);
  expect(getIcon().type).toBe(ORIGINAL_ICON_TYPE);
});

test('restores the title and icon on unmount', () => {
  const { unmount } = render(<UnreadIndicators unreadByMessenger={SOME_UNREAD} />);

  unmount();

  expect(document.title).toBe(ORIGINAL_TITLE);
  expect(getIcon().getAttribute('href')).toBe(ORIGINAL_ICON_HREF);
});

test('updates the title even without an icon link', () => {
  document.head.innerHTML = '';
  document.title = ORIGINAL_TITLE;

  render(<UnreadIndicators unreadByMessenger={SOME_UNREAD} />);

  expect(document.title).toBe('(6) Multi Messenger');
});
