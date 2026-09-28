import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import type { MessengerId } from '@/entities/messenger/model';

import { MessengerTabs } from './messenger-tabs';

const NO_UNREAD = { max: 0, telegram: 0, whatsapp: 0 };
const TAB_PATHS = { max: '/max/79161234567@c.us', telegram: '/telegram', whatsapp: '/whatsapp' };

function renderTabs(activeMessenger: MessengerId | null) {
  return render(
    <MessengerTabs
      activeMessenger={activeMessenger}
      tabPaths={TAB_PATHS}
      unreadByMessenger={NO_UNREAD}
    />,
  );
}

test('marks the active tab as the current page', () => {
  renderTabs('whatsapp');

  expect(screen.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: 'MAX' })).not.toHaveAttribute('aria-current');
});

test('orders tabs as MAX, WhatsApp, Telegram', () => {
  renderTabs('max');

  expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
    'MAX',
    'WhatsApp',
    'Telegram',
  ]);
});

test('links each tab to its path', () => {
  renderTabs('telegram');

  expect(screen.getByRole('link', { name: 'MAX' })).toHaveAttribute(
    'href',
    '/max/79161234567@c.us',
  );
  expect(screen.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', '/whatsapp');
});

test('shows the unread badge only for non-zero counters', () => {
  render(
    <MessengerTabs
      activeMessenger="max"
      tabPaths={TAB_PATHS}
      unreadByMessenger={{ max: 0, telegram: 3, whatsapp: 0 }}
    />,
  );

  expect(screen.getByLabelText('3 непрочитанных')).toHaveTextContent('3');
  expect(screen.queryAllByLabelText(/непрочитанных/)).toHaveLength(1);
});

test('renders without an active tab on unknown paths', () => {
  renderTabs(null);

  expect(screen.queryByRole('link', { current: 'page' })).toBeNull();
});
