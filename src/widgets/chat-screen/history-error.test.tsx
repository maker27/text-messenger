import { act, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { createMessengerStore } from '@/entities/message/messenger-store';
import { MessengerStoreContext } from '@/features/messenger-session/messenger-session-provider';
import { MemoryStorage } from '@/shared/testing/memory-storage';

import { HistoryError } from './history-error';

const { refresh } = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useRouter: () => ({ refresh }),
}));

afterEach(() => {
  vi.clearAllMocks();
});

function renderHistoryError() {
  const store = createMessengerStore({
    idInstance: '3100000000000001',
    messengerId: 'max',
    storage: new MemoryStorage(),
  });

  render(
    <MessengerStoreContext value={store}>
      <HistoryError error={{ code: 'network' }} messengerId="max" />
    </MessengerStoreContext>,
  );

  return store;
}

test('reloads the history once the connection is back online', () => {
  const store = renderHistoryError();

  act(() => {
    store.getState().setConnection({ retryAt: Date.now(), status: 'reconnecting' });
  });
  expect(refresh).not.toHaveBeenCalled();

  act(() => {
    store.getState().setConnection({ status: 'online' });
  });

  expect(refresh).toHaveBeenCalledOnce();
  expect(screen.getByRole('alert')).toBeInTheDocument();
});

test('does not reload again while the connection stays online', () => {
  const store = renderHistoryError();

  act(() => {
    store.getState().setConnection({ status: 'online' });
  });
  refresh.mockClear();

  act(() => {
    store.getState().setConnection({ status: 'online' });
  });

  expect(refresh).not.toHaveBeenCalled();
});
