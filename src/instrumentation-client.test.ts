import { z } from 'zod';
import { expect, test } from 'vitest';

test('keeps zod from probing eval, which the content security policy blocks', async () => {
  await import('./instrumentation-client');

  expect(z.config().jitless).toBe(true);
});
