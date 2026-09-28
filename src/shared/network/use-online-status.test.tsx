import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { useOnlineStatus } from './use-online-status';

function setNavigatorOnline(isOnline: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(isOnline);
  window.dispatchEvent(new Event(isOnline ? 'online' : 'offline'));
}

afterEach(() => {
  vi.restoreAllMocks();
});

test('reports the current network status', () => {
  const { result } = renderHook(() => useOnlineStatus());

  expect(result.current).toBe(true);
});

test('follows offline and online events', () => {
  const { result } = renderHook(() => useOnlineStatus());

  act(() => {
    setNavigatorOnline(false);
  });
  expect(result.current).toBe(false);

  act(() => {
    setNavigatorOnline(true);
  });
  expect(result.current).toBe(true);
});

test('stops listening after unmount', () => {
  const removeListener = vi.spyOn(window, 'removeEventListener');
  const { unmount } = renderHook(() => useOnlineStatus());

  unmount();

  expect(removeListener).toHaveBeenCalledWith('online', expect.any(Function));
  expect(removeListener).toHaveBeenCalledWith('offline', expect.any(Function));
});
