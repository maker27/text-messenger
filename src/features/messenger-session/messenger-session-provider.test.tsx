import { act, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { selectChatMessages } from '@/entities/message/messenger-store';
import type { MessengerId } from '@/entities/messenger/model';

import {
  MessengerSessionProvider,
  useMessengerStore,
  useUnreadCount,
} from './messenger-session-provider';
import type { SessionView } from './server';
import { SessionGate } from './session-gate';

const CHAT_ID = '79161234567@c.us';
const MAX_SESSION: SessionView = { idInstance: '3100000000000001', mode: 'demo' };
const TELEGRAM_SESSION: SessionView = { idInstance: '4100000000000001', mode: 'demo' };

const { logout, pathname, refresh } = vi.hoisted(() => ({
  logout: vi.fn(() => Promise.resolve({ data: null, ok: true })),
  pathname: { current: '/max' },
  refresh: vi.fn(),
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  usePathname: () => pathname.current,
  useRouter: () => ({ refresh }),
}));

vi.mock('@/features/login/actions', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  logout,
}));

class FakeEventSource extends EventTarget {
  static readonly CLOSED = 2;
  static readonly CONNECTING = 0;
  static instances: FakeEventSource[] = [];

  isClosedByClient = false;
  readyState = FakeEventSource.CONNECTING;

  constructor(readonly url: string) {
    super();
    FakeEventSource.instances.push(this);
  }

  close() {
    this.readyState = FakeEventSource.CLOSED;
    this.isClosedByClient = true;
  }

  override dispatchEvent(event: Event) {
    return this.isClosedByClient ? false : super.dispatchEvent(event);
  }

  emit(type: string, data: unknown) {
    act(() => {
      this.dispatchEvent(new MessageEvent(type, { data: JSON.stringify(data) }));
    });
  }

  fail(readyState: number) {
    this.readyState = readyState;
    act(() => {
      this.dispatchEvent(new Event('error'));
    });
  }
}

function getSource(messengerId: MessengerId) {
  const source = FakeEventSource.instances.findLast(({ url }) =>
    url.endsWith(`/api/${messengerId}/events`),
  );
  if (source === undefined) {
    throw new Error(`No event source for ${messengerId}`);
  }
  return source;
}

function createMessageFrame(text: string) {
  return {
    chatId: CHAT_ID,
    direction: 'incoming',
    idMessage: `id-${text}`,
    senderName: 'Анна',
    sentAt: 1_700_000_000_000,
    text,
  };
}

function Messages() {
  const messages = useMessengerStore(selectChatMessages(CHAT_ID));
  const isFaceActive = useMessengerStore((state) => state.isFaceActive);
  const historyVersion = useMessengerStore((state) => state.historyVersion);

  return (
    <ul
      aria-label={isFaceActive ? 'Активная грань' : 'Неактивная грань'}
      data-history-version={historyVersion}
    >
      {messages.map(({ idMessage, text }) => (
        <li key={idMessage}>{text}</li>
      ))}
    </ul>
  );
}

interface SessionsProps {
  children: ReactNode;
  maxSession: SessionView | null;
}

function Sessions({ children, maxSession }: SessionsProps) {
  return (
    <MessengerSessionProvider isRealModeEnabled={false} messengerId="max" session={maxSession}>
      <MessengerSessionProvider
        isRealModeEnabled={false}
        messengerId="telegram"
        session={TELEGRAM_SESSION}
      >
        {children}
      </MessengerSessionProvider>
    </MessengerSessionProvider>
  );
}

function UnreadCounts() {
  const maxUnreadCount = useUnreadCount('max');
  const telegramUnreadCount = useUnreadCount('telegram');

  return (
    <p aria-label="Непрочитанные">{`max ${String(maxUnreadCount)}, telegram ${String(telegramUnreadCount)}`}</p>
  );
}

function Faces() {
  return (
    <>
      <section aria-label="MAX">
        <SessionGate messengerId="max">
          <Messages />
        </SessionGate>
      </section>
      <section aria-label="Telegram">
        <SessionGate messengerId="telegram">
          <Messages />
        </SessionGate>
      </section>
    </>
  );
}

function renderSessions(maxSession: SessionView | null = MAX_SESSION) {
  const view = render(
    <Sessions maxSession={maxSession}>
      <Faces />
    </Sessions>,
  );

  return {
    ...view,
    rerenderSessions: (nextMaxSession: SessionView | null) => {
      view.rerender(
        <Sessions maxSession={nextMaxSession}>
          <Faces />
        </Sessions>,
      );
    },
  };
}

function getFace(name: string) {
  return screen.getByRole('region', { name });
}

beforeEach(() => {
  FakeEventSource.instances = [];
  pathname.current = '/max';
  vi.stubGlobal('EventSource', FakeEventSource);
  localStorage.clear();
  logout.mockClear();
  refresh.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('opens one stream per signed-in messenger', () => {
  renderSessions(null);

  expect(FakeEventSource.instances.map(({ url }) => url)).toStrictEqual(['/api/telegram/events']);
});

test('puts streamed messages into the store of their messenger', () => {
  renderSessions();

  getSource('max').emit('message', createMessageFrame('Привет'));

  expect(getFace('MAX')).toHaveTextContent('Привет');
  expect(getFace('Telegram')).not.toHaveTextContent('Привет');
});

test('skips invalid frames without breaking the stream', () => {
  renderSessions();
  const source = getSource('max');

  act(() => {
    source.dispatchEvent(new MessageEvent('message', { data: 'not json' }));
  });
  source.emit('message', { ...createMessageFrame('Без id'), idMessage: undefined });
  source.emit('message', createMessageFrame('Привет'));

  expect(getFace('MAX')).toHaveTextContent('Привет');
  expect(getFace('MAX')).not.toHaveTextContent('Без id');
});

test('ends an expired session and explains it on the sign-in screen', async () => {
  const { rerenderSessions } = renderSessions();
  const source = getSource('max');
  source.emit('message', createMessageFrame('Привет'));

  source.emit('connection', { status: 'unauthorized' });

  expect(getFace('MAX')).not.toHaveTextContent('Привет');
  expect(source.readyState).toBe(FakeEventSource.CLOSED);
  await vi.waitFor(() => {
    expect(refresh).toHaveBeenCalledOnce();
  });
  expect(logout).toHaveBeenCalledWith('max');

  rerenderSessions(null);

  expect(getFace('MAX')).toHaveTextContent('Сессия истекла. Войдите снова');
});

test('signs out of an instance of another messenger and keeps the reason', async () => {
  const { rerenderSessions } = renderSessions();

  getSource('max').emit('connection', { code: 'instanceTypeMismatch', status: 'stopped' });

  await vi.waitFor(() => {
    expect(refresh).toHaveBeenCalledOnce();
  });
  expect(logout).toHaveBeenCalledWith('max');
  rerenderSessions(null);
  expect(getFace('MAX')).toHaveTextContent('Этот инстанс не относится к MAX');
});

test('drops the reason once a new session appears', async () => {
  const { rerenderSessions } = renderSessions();
  getSource('max').emit('connection', { status: 'unauthorized' });
  await vi.waitFor(() => {
    expect(refresh).toHaveBeenCalledOnce();
  });
  rerenderSessions(null);

  rerenderSessions(MAX_SESSION);
  rerenderSessions(null);

  expect(getFace('MAX')).not.toHaveTextContent('Сессия истекла');
});

test('reopens the stream for a new session', async () => {
  const { rerenderSessions } = renderSessions();
  getSource('max').emit('connection', { status: 'unauthorized' });
  await vi.waitFor(() => {
    expect(refresh).toHaveBeenCalledOnce();
  });
  rerenderSessions(null);

  rerenderSessions(MAX_SESSION);

  expect(getSource('max').readyState).toBe(FakeEventSource.CONNECTING);
  expect(FakeEventSource.instances.filter(({ url }) => url.includes('/max/'))).toHaveLength(2);
});

test('leaves other messengers untouched when one session ends', async () => {
  renderSessions();
  getSource('telegram').emit('message', createMessageFrame('Телеграм'));

  getSource('max').emit('connection', { status: 'unauthorized' });

  await vi.waitFor(() => {
    expect(refresh).toHaveBeenCalledOnce();
  });
  expect(getFace('Telegram')).toHaveTextContent('Телеграм');
  expect(getSource('telegram').readyState).toBe(FakeEventSource.CONNECTING);
});

test('keeps the session but stops the stream when a webhook is configured', () => {
  renderSessions();
  const source = getSource('max');

  source.emit('connection', { code: 'webhookConfigured', status: 'stopped' });

  expect(source.readyState).toBe(FakeEventSource.CLOSED);
  expect(logout).not.toHaveBeenCalled();
});

test('ignores the error of a stream the server closed after a stop frame', () => {
  renderSessions();
  const source = getSource('max');

  act(() => {
    source.dispatchEvent(
      new MessageEvent('connection', {
        data: JSON.stringify({ code: 'webhookConfigured', status: 'stopped' }),
      }),
    );
    source.readyState = FakeEventSource.CLOSED;
    source.dispatchEvent(new Event('error'));
  });

  expect(refresh).not.toHaveBeenCalled();
});

test('invalidates the loaded histories on resync', () => {
  renderSessions();

  getSource('max').emit('resync', {});

  expect(within(getFace('MAX')).getByRole('list')).toHaveAttribute('data-history-version', '1');
  expect(within(getFace('Telegram')).getByRole('list')).toHaveAttribute(
    'data-history-version',
    '0',
  );
  expect(refresh).not.toHaveBeenCalled();
});

test('refreshes the page data when the server rejects the stream', () => {
  renderSessions();
  const source = getSource('max');

  source.fail(FakeEventSource.CLOSED);

  expect(refresh).toHaveBeenCalledOnce();
});

test('reopens a rejected stream with a growing delay', () => {
  vi.useFakeTimers();
  renderSessions();

  getSource('max').fail(FakeEventSource.CLOSED);
  act(() => {
    vi.advanceTimersByTime(999);
  });
  expect(getSource('max').readyState).toBe(FakeEventSource.CLOSED);
  act(() => {
    vi.advanceTimersByTime(1);
  });
  expect(getSource('max').readyState).toBe(FakeEventSource.CONNECTING);

  getSource('max').fail(FakeEventSource.CLOSED);
  act(() => {
    vi.advanceTimersByTime(1999);
  });
  expect(getSource('max').readyState).toBe(FakeEventSource.CLOSED);
  act(() => {
    vi.advanceTimersByTime(1);
  });
  expect(getSource('max').readyState).toBe(FakeEventSource.CONNECTING);
});

test('resets the reopen delay once the stream is online', () => {
  vi.useFakeTimers();
  renderSessions();
  getSource('max').fail(FakeEventSource.CLOSED);
  act(() => {
    vi.advanceTimersByTime(1000);
  });

  getSource('max').emit('connection', { status: 'online' });
  getSource('max').fail(FakeEventSource.CLOSED);
  act(() => {
    vi.advanceTimersByTime(1000);
  });

  expect(getSource('max').readyState).toBe(FakeEventSource.CONNECTING);
});

test('starts a new session with the shortest reopen delay', () => {
  vi.useFakeTimers();
  const { rerenderSessions } = renderSessions();
  getSource('max').fail(FakeEventSource.CLOSED);
  act(() => {
    vi.advanceTimersByTime(1000);
  });
  getSource('max').fail(FakeEventSource.CLOSED);

  rerenderSessions(null);
  rerenderSessions({ ...MAX_SESSION, idInstance: '3100000000000002' });
  getSource('max').fail(FakeEventSource.CLOSED);
  act(() => {
    vi.advanceTimersByTime(1000);
  });

  expect(getSource('max').readyState).toBe(FakeEventSource.CONNECTING);
});

test('leaves the page data alone when the page unload closes the stream', () => {
  renderSessions();

  window.dispatchEvent(new Event('beforeunload'));
  getSource('max').fail(FakeEventSource.CLOSED);

  expect(refresh).not.toHaveBeenCalled();
});

test('refreshes the page data when a page restored from cache finds its stream closed', () => {
  renderSessions();
  window.dispatchEvent(new Event('beforeunload'));
  getSource('max').fail(FakeEventSource.CLOSED);

  act(() => {
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });

  expect(refresh).toHaveBeenCalledOnce();
});

test('counts the unread messages of each messenger', () => {
  render(
    <Sessions maxSession={null}>
      <UnreadCounts />
    </Sessions>,
  );

  getSource('telegram').emit('message', createMessageFrame('Первое'));
  getSource('telegram').emit('message', createMessageFrame('Второе'));

  expect(screen.getByLabelText('Непрочитанные')).toHaveTextContent('max 0, telegram 2');
});

test('marks only the face of the current route as active', () => {
  pathname.current = '/telegram';

  renderSessions();

  expect(
    screen.getByRole('list', { name: 'Неактивная грань' }).closest('section'),
  ).toHaveAccessibleName('MAX');
  expect(
    screen.getByRole('list', { name: 'Активная грань' }).closest('section'),
  ).toHaveAccessibleName('Telegram');
});

test('closes the streams on unmount', () => {
  const { unmount } = renderSessions();

  unmount();

  expect(FakeEventSource.instances.map(({ readyState }) => readyState)).toStrictEqual([
    FakeEventSource.CLOSED,
    FakeEventSource.CLOSED,
  ]);
});

test('refuses store access outside a signed-in gate', () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);

  expect(() =>
    render(
      <Sessions maxSession={MAX_SESSION}>
        <Messages />
      </Sessions>,
    ),
  ).toThrow('useMessengerStore must be used inside a signed-in SessionGate');
});
