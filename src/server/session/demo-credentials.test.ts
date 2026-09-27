import { expect, test } from 'vitest';

import { apiTokenInstanceSchema, idInstanceSchema } from '@/server/green-api/credentials';

import { createDemoCredentials } from './demo-credentials';

test.each([
  ['max', '3100'],
  ['telegram', '4100'],
  ['whatsapp', '1101'],
] as const)('issues %s credentials of the mock instance', (messengerId, prefix) => {
  const credentials = createDemoCredentials(messengerId);

  expect(credentials.idInstance.startsWith(prefix)).toBe(true);
  expect(idInstanceSchema.safeParse(credentials.idInstance).success).toBe(true);
  expect(apiTokenInstanceSchema.safeParse(credentials.apiTokenInstance).success).toBe(true);
  expect(credentials.apiUrl).toBe('http://127.0.0.1:3100');
});

test('issues distinct credentials for every demo session', () => {
  const first = createDemoCredentials('max');
  const second = createDemoCredentials('max');

  expect(first.idInstance).not.toBe(second.idInstance);
  expect(first.apiTokenInstance).not.toBe(second.apiTokenInstance);
});
