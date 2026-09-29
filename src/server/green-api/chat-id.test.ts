import { expect, test } from 'vitest';

import { parsePhoneNumber } from '@/entities/chat/phone-number';

import {
  checkAccountSchema,
  checkWhatsappSchema,
  parseChatId,
  parseRouteChatId,
  selectWhatsappChatId,
} from './chat-id';
import { unwrapResult } from './test-server';

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

const LID_CHAT_ID = '123456789012345@lid';
const PHONE_CHAT_ID = '79161234567@c.us';
const PHONE_NUMBER = unwrapResult(parsePhoneNumber('+7 916 123-45-67', null));

test.each([
  [PHONE_CHAT_ID, { accountChatId: LID_CHAT_ID, phoneChatId: PHONE_CHAT_ID }],
  ['', { accountChatId: LID_CHAT_ID, phoneChatId: null }],
])('reads a WhatsApp account with phone number %j', (phoneNumber, account) => {
  expect(
    checkWhatsappSchema.parse({ chatId: LID_CHAT_ID, existsWhatsapp: true, phoneNumber }),
  ).toEqual({ ok: true, data: account });
});

test('reports a missing WhatsApp account', () => {
  expect(checkWhatsappSchema.parse({ existsWhatsapp: false })).toEqual({
    ok: false,
    error: { code: 'accountNotFound' },
  });
});

test.each([
  { chatId: '79161234567@g.us', existsWhatsapp: true, phoneNumber: PHONE_CHAT_ID },
  { chatId: LID_CHAT_ID, existsWhatsapp: true },
  { chatId: LID_CHAT_ID, existsWhatsapp: true, phoneNumber: '79161234567' },
  { existsWhatsapp: true },
])('rejects checkWhatsapp response %j', (response) => {
  expect(checkWhatsappSchema.safeParse(response).success).toBe(false);
});

test.each([
  [true, { accountChatId: LID_CHAT_ID, phoneChatId: PHONE_CHAT_ID }, LID_CHAT_ID],
  [false, { accountChatId: LID_CHAT_ID, phoneChatId: '79161234568@c.us' }, '79161234568@c.us'],
  [false, { accountChatId: LID_CHAT_ID, phoneChatId: null }, PHONE_CHAT_ID],
])('selects the WhatsApp chat id with LID mode %s', (isLidModeEnabled, account, chatId) => {
  expect(selectWhatsappChatId(account, PHONE_NUMBER, isLidModeEnabled)).toBe(chatId);
});

test.each([
  ['whatsapp', '79161234567@c.us'],
  ['whatsapp', '123@lid'],
  ['max', '-100123'],
  ['max', '123'],
  ['telegram', '-100123'],
  ['telegram', '123'],
] as const)('accepts the %s route chat id %s', (messengerId, chatId) => {
  expect(parseRouteChatId(messengerId, chatId)).toBe(chatId);
});

test('decodes the route chat id of a url segment', () => {
  expect(parseRouteChatId('whatsapp', '79161234567%40c.us')).toBe('79161234567@c.us');
});

test.each([
  ['whatsapp', 'abc'],
  ['whatsapp', '1@g.us'],
  ['whatsapp', '123'],
  ['max', '123@c.us'],
  ['telegram', 'abc'],
  ['max', ''],
  ['telegram', '1\u0000'],
  ['max', '1%2F2'],
] as const)('rejects the %s route chat id %j', (messengerId, chatId) => {
  expect(parseRouteChatId(messengerId, chatId)).toBeNull();
});

test('accepts a decoded chat id as is', () => {
  expect(parseChatId('whatsapp', '79161234567@c.us')).toBe('79161234567@c.us');
});

test.each([
  ['whatsapp', '79161234567%40c.us'],
  ['max', '%31'],
  ['max', '%'],
] as const)('does not decode the %s chat id %j', (messengerId, chatId) => {
  expect(parseChatId(messengerId, chatId)).toBeNull();
});
