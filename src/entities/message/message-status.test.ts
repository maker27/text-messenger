import { expect, test } from 'vitest';

import { mergeMessageStatus } from './message-status';

test.each([
  [null, 'pending', 'pending'],
  ['pending', 'sent', 'sent'],
  ['sent', 'read', 'read'],
  ['delivered', 'read', 'read'],
  ['read', 'delivered', 'read'],
  ['delivered', 'sent', 'delivered'],
  ['pending', 'failed', 'failed'],
  ['sent', 'failed', 'failed'],
  ['delivered', 'failed', 'delivered'],
  ['read', 'failed', 'read'],
  ['failed', 'sent', 'failed'],
  ['failed', 'read', 'failed'],
] as const)('merges %s with %s into %s', (current, next, merged) => {
  expect(mergeMessageStatus(current, next)).toBe(merged);
});
