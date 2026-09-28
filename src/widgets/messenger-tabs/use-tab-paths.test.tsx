import { renderHook } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import { expect, test, vi } from 'vitest';

import type { MessengerId } from '@/entities/messenger/model';

import { useTabPaths } from './use-tab-paths';

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: vi.fn(),
}));

test('returns to the last visited path of a tab', () => {
  vi.mocked(usePathname).mockReturnValue('/max/79161234567@c.us');
  const { rerender, result } = renderHook(
    ({ activeMessenger }: { activeMessenger: MessengerId | null }) => useTabPaths(activeMessenger),
    { initialProps: { activeMessenger: 'max' } },
  );

  vi.mocked(usePathname).mockReturnValue('/telegram');
  rerender({ activeMessenger: 'telegram' });

  expect(result.current).toEqual({
    max: '/max/79161234567@c.us',
    telegram: '/telegram',
    whatsapp: '/whatsapp',
  });
});
