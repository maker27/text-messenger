import { expect, test } from 'vitest';
import { GET } from './route';

test('reports ok status', async () => {
  const response = GET();

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ status: 'ok' });
});
