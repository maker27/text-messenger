import { expect, test } from 'vitest';

import { MESSENGERS } from './config';

test.each(Object.entries(MESSENGERS))('keys %s by its own id', (key, config) => {
  expect(config.id).toBe(key);
});

test.each([
  [
    MESSENGERS.max,
    {
      allowedCountryCodes: ['7', '375'],
      chatIdStrategy: 'checkAccount',
      maxMessageLength: 4000,
      typeInstance: 'v3',
    },
  ],
  [
    MESSENGERS.telegram,
    {
      allowedCountryCodes: null,
      chatIdStrategy: 'checkAccount',
      maxMessageLength: 4096,
      typeInstance: 'telegram',
    },
  ],
  [
    MESSENGERS.whatsapp,
    {
      allowedCountryCodes: null,
      chatIdStrategy: 'checkWhatsapp',
      maxMessageLength: 20000,
      typeInstance: 'whatsapp',
    },
  ],
])('matches the GREEN-API limits of $title', (config, expected) => {
  expect(config).toMatchObject(expected);
});
