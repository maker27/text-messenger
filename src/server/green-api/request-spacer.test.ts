import { expect, test } from 'vitest';

import { createRequestSpacer } from './request-spacer';

const INTERVAL_MS = 1000;
const MAX_KEYS = 2;

function createSpacer() {
  const clock = { time: 0 };
  const spacer = createRequestSpacer({
    intervalMs: INTERVAL_MS,
    maxKeys: MAX_KEYS,
    now: () => clock.time,
  });

  return { clock, spacer };
}

test('lets the first request go without a delay', () => {
  const { spacer } = createSpacer();

  expect(spacer.tryAcquire('whatsapp:1')).toBe(0);
});

test('asks a request of one key to wait out the rest of the interval', () => {
  const { clock, spacer } = createSpacer();
  spacer.tryAcquire('whatsapp:1');
  clock.time = 300;

  expect(spacer.tryAcquire('whatsapp:1')).toBe(700);
  expect(spacer.tryAcquire('whatsapp:1')).toBe(700);
});

test('does not reserve anything for a request that is asked to wait', () => {
  const { clock, spacer } = createSpacer();
  spacer.tryAcquire('whatsapp:1');
  clock.time = 300;
  spacer.tryAcquire('whatsapp:1');
  clock.time = INTERVAL_MS;

  expect(spacer.tryAcquire('whatsapp:1')).toBe(0);
  expect(spacer.tryAcquire('whatsapp:1')).toBe(INTERVAL_MS);
});

test('spaces keys independently', () => {
  const { spacer } = createSpacer();
  spacer.tryAcquire('whatsapp:1');

  expect(spacer.tryAcquire('whatsapp:2')).toBe(0);
  expect(spacer.tryAcquire('max:1')).toBe(0);
});

test('forgets the least recently used key over the key limit', () => {
  const { spacer } = createSpacer();
  spacer.tryAcquire('whatsapp:1');
  spacer.tryAcquire('whatsapp:2');
  spacer.tryAcquire('whatsapp:3');

  expect(spacer.tryAcquire('whatsapp:1')).toBe(0);
  expect(spacer.tryAcquire('whatsapp:3')).toBe(INTERVAL_MS);
});
