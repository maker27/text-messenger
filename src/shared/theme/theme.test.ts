import { expect, test } from 'vitest';

import { parseTheme } from './theme';

test.each(['dark', 'light'])('keeps %s', (value) => {
  expect(parseTheme(value)).toBe(value);
});

test.each([undefined, '', 'DARK', 'system', 'blue'])(
  'falls back to the system theme for %j',
  (value) => {
    expect(parseTheme(value)).toBeNull();
  },
);
