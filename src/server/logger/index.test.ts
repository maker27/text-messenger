import { expect, test } from 'vitest';

import { createLogger } from './index';

function createMemoryLogger(level: 'info' | 'silent') {
  const lines: string[] = [];
  const logger = createLogger(level, {
    write: (line) => {
      lines.push(line);
    },
  });
  return { lines, logger };
}

test('redacts secrets at the top level and one level deep', () => {
  const { lines, logger } = createMemoryLogger('info');

  logger.info(
    {
      apiTokenInstance: 'secret-token',
      request: { phoneNumber: '79161234567', text: 'hello', url: 'https://host/secret-token' },
      status: 401,
    },
    'request failed',
  );

  expect(lines).toHaveLength(1);
  expect(lines[0]).not.toContain('secret-token');
  expect(lines[0]).not.toContain('79161234567');
  expect(lines[0]).not.toContain('hello');
  expect(lines[0]).toContain('"status":401');
  expect(lines[0]).toContain('"apiTokenInstance":"[redacted]"');
});

test('writes nothing at the silent level', () => {
  const { lines, logger } = createMemoryLogger('silent');

  logger.error('failure');

  expect(lines).toEqual([]);
});
