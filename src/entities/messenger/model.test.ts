import { expect, test } from 'vitest';

import { messengerIdSchema } from './model';

test.each(['max', 'telegram', 'whatsapp'])('accepts %s', (value) => {
  expect(messengerIdSchema.safeParse(value).success).toBe(true);
});

test.each(['MAX', '', '__proto__', null])('rejects %j', (value) => {
  expect(messengerIdSchema.safeParse(value).success).toBe(false);
});
