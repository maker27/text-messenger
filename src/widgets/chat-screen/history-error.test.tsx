import { act, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { createMessengerStore } from '@/entities/message/messenger-store';
import { MessengerStoreContext } from '@/features/messenger-session/messenger-session-provider';
import { MemoryStorage } from '@/shared/testing/memory-storage';

import { HistoryError } from './history-error';

function renderHistoryError(onRetry: () => void) {
  const store = createMessengerStore({
    idInstance: '3100000000000001',
    messengerId: 'max',
    storage: new MemoryStorage(),
  });

  render(
    <MessengerStoreContext value={store}>
      <HistoryError
        className="flex-1"
        error={{ code: 'network' }}
        messengerId="max"
        onRetry={onRetry}
      />
    </MessengerStoreContext>,
  );

  return store;
}

test('reloads the history once the connection is back online', () => {
  const onRetry = vi.fn();
  const store = renderHistoryError(onRetry);

  act(() => {
    store.getState().setConnection({ retryAt: Date.now(), status: 'reconnecting' });
  });
  expect(onRetry).not.toHaveBeenCalled();

  act(() => {
    store.getState().setConnection({ status: 'online' });
  });

  expect(onRetry).toHaveBeenCalledOnce();
  expect(screen.getByRole('alert')).toBeInTheDocument();
});

test('does not reload again while the connection stays online', () => {
  const onRetry = vi.fn();
  const store = renderHistoryError(onRetry);

  act(() => {
    store.getState().setConnection({ status: 'online' });
  });
  onRetry.mockClear();

  act(() => {
    store.getState().setConnection({ status: 'online' });
  });

  expect(onRetry).not.toHaveBeenCalled();
});
