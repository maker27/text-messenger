import { expect, test } from 'vitest';

import { getActiveMessenger } from './active-messenger';

test.each([
  ['/max', 'max'],
  ['/max/79161234567@c.us', 'max'],
  ['/whatsapp', 'whatsapp'],
  ['/telegram/', 'telegram'],
])('reads %s as %s', (pathname, messengerId) => {
  expect(getActiveMessenger(pathname)).toBe(messengerId);
});

test.each(['/', '', '/viber', '/MAX', '/privacy', '/__proto__'])('reads %j as none', (pathname) => {
  expect(getActiveMessenger(pathname)).toBeNull();
});
