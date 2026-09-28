import { expect, test } from 'vitest';

import { getChatPath } from './chat-path';

test('encodes the chat id into the chat path', () => {
  expect(getChatPath('whatsapp', '79161234567@c.us')).toBe('/whatsapp/79161234567%40c.us');
});

test('keeps a numeric chat id as is', () => {
  expect(getChatPath('telegram', '-1001234567890')).toBe('/telegram/-1001234567890');
});
