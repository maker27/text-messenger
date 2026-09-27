import { expect, test } from 'vitest';

import { apiTokenInstanceSchema, idInstanceSchema } from './credentials';

const MAX_TOKEN_LENGTH = 256;

test('accepts a hex token', () => {
  expect(apiTokenInstanceSchema.parse('d75b3a66374942c5b3c019c698abc2067e151558acbd412345')).toBe(
    'd75b3a66374942c5b3c019c698abc2067e151558acbd412345',
  );
});

test.each([
  '',
  'abc/def',
  'abc?x',
  'abc#x',
  '..',
  '%2e%2e',
  'a b',
  'a'.repeat(MAX_TOKEN_LENGTH + 1),
])('rejects token %j', (value) => {
  expect(apiTokenInstanceSchema.safeParse(value).success).toBe(false);
});

test('accepts a numeric instance id', () => {
  expect(idInstanceSchema.parse('1101000001')).toBe('1101000001');
});

test.each(['', 'abc', '1101/..', '-1', '1'.repeat(21)])('rejects instance id %j', (value) => {
  expect(idInstanceSchema.safeParse(value).success).toBe(false);
});
