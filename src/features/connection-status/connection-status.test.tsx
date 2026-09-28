import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { createMessengerStore } from '@/entities/message/messenger-store';
import { MessengerStoreContext } from '@/features/messenger-session/messenger-session-provider';
import { MemoryStorage } from '@/shared/testing/memory-storage';

import { ConnectionStatus } from './connection-status';

const NOW = 1_700_000_000_000;

function renderStatus() {
  const store = createMessengerStore({
    idInstance: '3100000000000001',
    messengerId: 'max',
    storage: new MemoryStorage(),
  });

  render(
    <MessengerStoreContext value={store}>
      <ConnectionStatus messengerId="max" />
    </MessengerStoreContext>,
  );

  return store.getState();
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
});

afterEach(() => {
  vi.useRealTimers();
});

test('shows the connecting state until the stream reports', () => {
  renderStatus();

  expect(screen.getByRole('status')).toHaveTextContent('Подключение…');
});

test('shows the online state', () => {
  const { setConnection } = renderStatus();

  act(() => {
    setConnection({ status: 'online' });
  });

  expect(screen.getByRole('status')).toHaveTextContent('В сети');
});

test('counts down to the next reconnect attempt without re-announcing it', () => {
  const { setConnection } = renderStatus();

  act(() => {
    setConnection({ retryAt: NOW + 3000, status: 'reconnecting' });
  });
  expect(screen.getByRole('status')).toHaveTextContent(/^Переподключение…$/);
  expect(screen.getByText('3 с')).toBeInTheDocument();

  act(() => {
    vi.advanceTimersByTime(1000);
  });
  expect(screen.getByRole('status')).toHaveTextContent(/^Переподключение…$/);
  expect(screen.getByText('2 с')).toBeInTheDocument();

  act(() => {
    vi.advanceTimersByTime(5000);
  });
  expect(screen.getByText('0 с')).toBeInTheDocument();
});

test('restarts the countdown for the next attempt', () => {
  const { setConnection } = renderStatus();
  act(() => {
    setConnection({ retryAt: NOW + 2000, status: 'reconnecting' });
  });
  act(() => {
    vi.advanceTimersByTime(2000);
  });

  act(() => {
    setConnection({ retryAt: NOW + 6000, status: 'reconnecting' });
  });

  expect(screen.getByText('4 с')).toBeInTheDocument();
});

test('explains a stream stopped by a webhook', () => {
  const { setConnection } = renderStatus();

  act(() => {
    setConnection({ code: 'webhookConfigured', status: 'stopped' });
  });

  expect(screen.getByRole('status')).toHaveTextContent('Для инстанса задан webhook URL');
});

test('explains a stream stopped without a known reason', () => {
  const { setConnection } = renderStatus();

  act(() => {
    setConnection({ code: null, status: 'stopped' });
  });

  expect(screen.getByRole('status')).toHaveTextContent('Получение сообщений остановлено');
});
