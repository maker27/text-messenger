import { expect, test } from 'vitest';

import { parsePhoneNumber } from './phone-number';

const MAX_COUNTRY_CODES = ['7', '375'];

test.each([
  ['+7 916 123-45-67', '79161234567'],
  ['8 (916) 123-45-67', '79161234567'],
  ['79161234567', '79161234567'],
  ['9161234567', '79161234567'],
  ['+375 29 123-45-67', '375291234567'],
  ['375291234567', '375291234567'],
  ['+1 650 253 0000', '16502530000'],
])('normalizes %s to %s', (value, phoneNumber) => {
  expect(parsePhoneNumber(value, null)).toEqual({ ok: true, data: phoneNumber });
});

test.each([
  '',
  '   ',
  '123',
  'abc',
  '+7 916 123-45-678',
  '+7 916 123-45-67 доб. 12',
  '9161234567 доб. 12',
  '8 (916) 123-45-67 доб. 12',
  '9161234567 ext 12',
  '+0 123 456 7890',
])('rejects %j', (value) => {
  expect(parsePhoneNumber(value, null)).toEqual({ ok: false, error: 'invalid' });
});

test('accepts numbers of allowed countries', () => {
  expect(parsePhoneNumber('+375 29 123-45-67', MAX_COUNTRY_CODES)).toEqual({
    ok: true,
    data: '375291234567',
  });
});

test('rejects numbers of other countries', () => {
  expect(parsePhoneNumber('+1 650 253 0000', MAX_COUNTRY_CODES)).toEqual({
    ok: false,
    error: 'countryNotAllowed',
  });
});
