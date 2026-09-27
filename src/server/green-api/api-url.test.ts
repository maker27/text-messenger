import { describe, expect, test } from 'vitest';

import { createApiUrlSchema } from './api-url';

const MOCK_URL = 'http://127.0.0.1:3100';

const realModeSchema = createApiUrlSchema({ isRealModeEnabled: true, mockUrl: MOCK_URL });
const demoModeSchema = createApiUrlSchema({ isRealModeEnabled: false, mockUrl: MOCK_URL });

describe('real mode', () => {
  test.each([
    ['https://1101.api.green-api.com', 'https://1101.api.green-api.com'],
    ['https://7103.api.greenapi.com/', 'https://7103.api.greenapi.com'],
    ['https://api.greenapi.com', 'https://api.greenapi.com'],
    ['https://api.green-api.com', 'https://api.green-api.com'],
    ['https://1101.API.Green-Api.com:443/', 'https://1101.api.green-api.com'],
    [MOCK_URL, MOCK_URL],
  ])('accepts %s as %s', (value, origin) => {
    expect(realModeSchema.parse(value)).toBe(origin);
  });

  test.each([
    'javascript:alert(1)',
    'https://1101.аpi.green-api.com',
    'https://1101.api.green-api.com.evil.com',
    'https://1101.api.green-api.com.',
    'https://evil.com/1101.api.green-api.com',
    'http://1101.api.green-api.com',
    'https://1101.api.green-api.com:8443',
    'https://user:pass@1101.api.green-api.com',
    'https://1101.api.green-api.com/waInstance1101',
    'https://1101.api.green-api.com?x=1',
    'https://1101.api.green-api.com#x',
    'https://api.green-api.com.evil.com',
    'https:1101.api.green-api.com',
    ' https://1101.api.green-api.com',
    'https://1101.api.green-api.com\t',
    'https://1101.api.\ngreen-api.com',
    'not a url',
    'http://127.0.0.1:3101',
  ])('rejects %s', (value) => {
    expect(realModeSchema.safeParse(value).success).toBe(false);
  });
});

describe('demo mode', () => {
  test('rejects a real GREEN-API host', () => {
    expect(demoModeSchema.safeParse('https://1101.api.green-api.com').success).toBe(false);
  });

  test('accepts the mock origin', () => {
    expect(demoModeSchema.parse(`${MOCK_URL}/`)).toBe(MOCK_URL);
  });
});
