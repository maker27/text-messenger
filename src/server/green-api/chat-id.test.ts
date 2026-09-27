import { expect, test } from 'vitest';

import { checkAccountSchema, checkWhatsappSchema } from './chat-id';

test.each([
  [{ chatId: '10000000123', exist: true }, '10000000123'],
  [{ chatId: 10000000123, exist: true }, '10000000123'],
  [{ chatId: '-10000000123', exist: true }, '-10000000123'],
])('reads the chat id from checkAccount %j', (response, chatId) => {
  expect(checkAccountSchema.parse(response)).toEqual({ ok: true, data: chatId });
});

test('reports a missing account from checkAccount', () => {
  expect(checkAccountSchema.parse({ exist: false })).toEqual({
    ok: false,
    error: { code: 'accountNotFound' },
  });
});

test.each([
  [30_000, 30],
  [11_930_619, 11_931],
])('maps a checkAccount rate limit of %i ms to %i s', (retryAfterMs, retryAfter) => {
  expect(
    checkAccountSchema.parse({
      data: { reason: 'rate_limit_exceeded', retryAfter: retryAfterMs, status: 'fail' },
      status: false,
    }),
  ).toEqual({ ok: false, error: { code: 'rateLimited', retryAfter } });
});

test('maps any other checkAccount refusal to an upstream error', () => {
  expect(
    checkAccountSchema.parse({ reason: 'Phone number is not supported', status: false }),
  ).toEqual({
    ok: false,
    error: { code: 'upstream' },
  });
});

test.each([
  { chatId: 'abc', exist: true },
  { exist: true },
  { status: false },
  { data: { reason: 'rate_limit_exceeded' }, status: false },
  {},
])('rejects checkAccount response %j', (response) => {
  expect(checkAccountSchema.safeParse(response).success).toBe(false);
});

test.each(['79161234567@c.us', '123456789012345@lid'])('reads WhatsApp chat id %s', (chatId) => {
  expect(checkWhatsappSchema.parse({ chatId, existsWhatsapp: true })).toEqual({
    ok: true,
    data: chatId,
  });
});

test('reports a missing WhatsApp account', () => {
  expect(checkWhatsappSchema.parse({ existsWhatsapp: false })).toEqual({
    ok: false,
    error: { code: 'accountNotFound' },
  });
});

test.each([{ chatId: '79161234567@g.us', existsWhatsapp: true }, { existsWhatsapp: true }])(
  'rejects checkWhatsapp response %j',
  (response) => {
    expect(checkWhatsappSchema.safeParse(response).success).toBe(false);
  },
);
