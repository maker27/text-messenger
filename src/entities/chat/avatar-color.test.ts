import { expect, test } from 'vitest';

import { getAvatarColor } from './avatar-color';

test('returns the same color for the same chat id', () => {
  const chatId = '79161234567@c.us';

  expect(getAvatarColor(chatId)).toBe(getAvatarColor(chatId));
});

test('returns a color from the fixed palette', () => {
  const color = getAvatarColor('79161234567@c.us');

  expect(color).toMatch(/^#[0-9a-f]{6}$/);
});

test('spreads different chat ids across the palette', () => {
  const chatIds = Array.from(
    { length: 12 },
    (_, index) => `79${String(index).padStart(9, '0')}@c.us`,
  );
  const colors = new Set(chatIds.map(getAvatarColor));

  expect(colors.size).toBeGreaterThan(1);
});
