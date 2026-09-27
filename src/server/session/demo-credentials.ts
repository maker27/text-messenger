import 'server-only';

import { randomInt } from 'node:crypto';

import type { MessengerId } from '@/entities/messenger/model';
import { env } from '@/server/env';
import { getApiUrlSchema } from '@/server/green-api/api-url';
import {
  apiTokenInstanceSchema,
  idInstanceSchema,
  type GreenApiCredentials,
} from '@/server/green-api/credentials';

// The mock picks the emulated messenger by these idInstance prefixes.
const DEMO_INSTANCE_PREFIX: Record<MessengerId, string> = {
  max: '3100',
  telegram: '4100',
  whatsapp: '1101',
};
const DEMO_INSTANCE_SUFFIX_LENGTH = 12;
const DEMO_TOKEN_LENGTH = 50;
const DIGITS = '0123456789';
const TOKEN_ALPHABET = `${DIGITS}abcdefghijklmnopqrstuvwxyz`;

function createRandomString(alphabet: string, length: number) {
  return Array.from({ length }, () => alphabet.charAt(randomInt(alphabet.length))).join('');
}

export function createDemoCredentials(messengerId: MessengerId): GreenApiCredentials {
  return {
    apiTokenInstance: apiTokenInstanceSchema.parse(
      createRandomString(TOKEN_ALPHABET, DEMO_TOKEN_LENGTH),
    ),
    apiUrl: getApiUrlSchema().parse(env.GREEN_API_MOCK_URL),
    idInstance: idInstanceSchema.parse(
      `${DEMO_INSTANCE_PREFIX[messengerId]}${createRandomString(DIGITS, DEMO_INSTANCE_SUFFIX_LENGTH)}`,
    ),
  };
}
