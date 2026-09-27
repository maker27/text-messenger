import { expect, test } from 'vitest';

import { createInstanceStore } from './instance-store.ts';
import { findMockMessenger } from './messengers.ts';

const WHATSAPP_INSTANCE = '1101000001';
const OTHER_WHATSAPP_INSTANCE = '1101000002';

function getWhatsappMessenger() {
  const messenger = findMockMessenger(WHATSAPP_INSTANCE);
  if (messenger === null) {
    throw new Error('WhatsApp mock messenger is missing');
  }
  return messenger;
}

test('binds the token on first use', () => {
  const store = createInstanceStore(2);
  const messenger = getWhatsappMessenger();

  const instance = store.authorize(WHATSAPP_INSTANCE, messenger, 'tokenA');

  expect(store.authorize(WHATSAPP_INSTANCE, messenger, 'tokenA')).toBe(instance);
  expect(store.authorize(WHATSAPP_INSTANCE, messenger, 'tokenB')).toBeNull();
});

test('evicts the least recently used instance', () => {
  const store = createInstanceStore(1);
  const messenger = getWhatsappMessenger();

  store.authorize(WHATSAPP_INSTANCE, messenger, 'tokenA');
  store.authorize(OTHER_WHATSAPP_INSTANCE, messenger, 'tokenB');

  expect(store.authorize(WHATSAPP_INSTANCE, messenger, 'tokenC')).not.toBeNull();
});

test('resolves messengers by instance prefix', () => {
  expect(findMockMessenger('3100000001')?.typeInstance).toBe('v3');
  expect(findMockMessenger('4100000001')?.typeInstance).toBe('telegram');
  expect(findMockMessenger(WHATSAPP_INSTANCE)?.typeInstance).toBe('whatsapp');
  expect(findMockMessenger('9999000001')).toBeNull();
});
