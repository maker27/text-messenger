import { render, screen } from '@testing-library/react';
import Link from 'next/link';
import { expect, test } from 'vitest';

import { clickLink } from '@/shared/testing/click-link';

import { handleCurrentPageLinkClick } from './current-page-link';

function renderLink() {
  render(
    <Link href="/whatsapp" onClick={handleCurrentPageLinkClick}>
      WhatsApp
    </Link>,
  );

  return screen.getByRole('link', { name: 'WhatsApp' });
}

test('cancels a plain click on the current page link', () => {
  expect(clickLink(renderLink())).toBe(true);
});

test.each(['altKey', 'ctrlKey', 'metaKey', 'shiftKey'] as const)(
  'keeps the browser action of a click with %s',
  (modifier) => {
    expect(clickLink(renderLink(), { [modifier]: true })).toBe(false);
  },
);
