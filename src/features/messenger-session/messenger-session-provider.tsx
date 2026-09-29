'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  createContext,
  startTransition,
  use,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useStore, type ExtractState } from 'zustand';

import type { Chat } from '@/entities/chat/model';
import { createMessengerStore, selectUnreadTotal } from '@/entities/message/messenger-store';
import { getActiveMessenger } from '@/entities/messenger/active-messenger';
import type { MessengerId } from '@/entities/messenger/model';
import { logout } from '@/features/login/actions';
import type { LoginReason } from '@/shared/errors/model';

import type { SessionView } from './server';
import { streamMessageSchemas } from './stream-schemas';
import { useEventSource } from './use-event-source';

const STREAM_EVENT_NAMES = [
  'connection',
  'message',
  'resync',
  'status',
] as const satisfies readonly (keyof typeof streamMessageSchemas)[];

const NO_CHATS: Chat[] = [];
const BASE_REOPEN_DELAY_MS = 1000;
const MAX_REOPEN_DELAY_MS = 30_000;

type MessengerStore = ReturnType<typeof createMessengerStore>;

type StreamEventName = (typeof STREAM_EVENT_NAMES)[number];

interface MessengerSession {
  isRealModeEnabled: boolean;
  loginReason: LoginReason | null;
  session: SessionView | null;
  store: MessengerStore | null;
}

interface PendingReopen {
  retryAt: number;
  store: MessengerStore;
}

interface StoreEntry {
  idInstance: string;
  store: MessengerStore;
}

const MessengerSessionsContext = createContext<Partial<Record<MessengerId, MessengerSession>>>({});

export const MessengerStoreContext = createContext<MessengerStore | null>(null);

interface MessengerSessionProviderProps {
  children: ReactNode;
  isRealModeEnabled: boolean;
  messengerId: MessengerId;
  session: SessionView | null;
}

export function MessengerSessionProvider({
  children,
  isRealModeEnabled,
  messengerId,
  session,
}: MessengerSessionProviderProps) {
  const parentSessions = use(MessengerSessionsContext);
  const router = useRouter();
  const isFaceActive = getActiveMessenger(usePathname()) === messengerId;
  // localStorage exists only in the browser, so the store appears after hydration.
  const isClient = useSyncExternalStore(subscribeToNothing, getClientSnapshot, getServerSnapshot);
  const idInstance = isClient ? (session?.idInstance ?? null) : null;
  const [storeEntry, setStoreEntry] = useState<StoreEntry | null>(null);
  const [closedStore, setClosedStore] = useState<MessengerStore | null>(null);
  const [pendingReopen, setPendingReopen] = useState<PendingReopen | null>(null);
  const [reopenAttempt, setReopenAttempt] = useState(0);
  const [loginReason, setLoginReason] = useState<LoginReason | null>(null);
  const hasSession = session !== null;
  const [hadSession, setHadSession] = useState(hasSession);

  if ((storeEntry?.idInstance ?? null) !== idInstance) {
    setStoreEntry(
      idInstance === null
        ? null
        : {
            idInstance,
            store: createMessengerStore({ idInstance, messengerId, storage: window.localStorage }),
          },
    );
    setPendingReopen(null);
    setReopenAttempt(0);
  }

  // The reason must survive refreshes that still carry the old session, so it resets only
  // when a session appears.
  if (hadSession !== hasSession) {
    setHadSession(hasSession);

    if (hasSession) {
      setLoginReason(null);
    }
  }

  const store = storeEntry?.store ?? null;
  const streamUrl =
    store !== null && store !== closedStore && store !== pendingReopen?.store
      ? `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/api/${messengerId}/events`
      : null;

  useEffect(() => {
    store?.getState().setIsFaceActive(isFaceActive);
  }, [isFaceActive, store]);

  useEffect(() => {
    if (pendingReopen === null) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setPendingReopen(null);
    }, pendingReopen.retryAt - Date.now());

    return () => {
      clearTimeout(timeoutId);
    };
  }, [pendingReopen]);

  function stopStream(currentStore: MessengerStore, closeSource: () => void) {
    closeSource();
    setClosedStore(currentStore);
  }

  function endSession(currentStore: MessengerStore, reason: LoginReason, closeSource: () => void) {
    setLoginReason(reason);
    stopStream(currentStore, closeSource);
    currentStore.getState().clear();
    // The session cookie stays valid after GREEN-API rejects the instance, so it is removed here.
    startTransition(async () => {
      await logout(messengerId);
      router.refresh();
    });
  }

  function handleFrame(eventName: StreamEventName, data: unknown, closeSource: () => void) {
    if (store === null) {
      return;
    }

    const { getState } = store;

    switch (eventName) {
      case 'connection': {
        const frame = streamMessageSchemas.connection.safeParse(data);

        if (!frame.success) {
          return;
        }

        const connection = frame.data;

        if (connection.status === 'unauthorized') {
          endSession(store, 'sessionExpired', closeSource);
        } else if (
          connection.status === 'stopped' &&
          (connection.code === 'instanceTypeMismatch' || connection.code === 'realModeDisabled')
        ) {
          endSession(store, connection.code, closeSource);
        } else {
          getState().setConnection(connection);

          if (connection.status === 'online') {
            setReopenAttempt(0);
          }

          if (connection.status === 'stopped') {
            stopStream(store, closeSource);
          }
        }
        return;
      }
      case 'message': {
        const frame = streamMessageSchemas.message.safeParse(data);

        if (frame.success) {
          getState().receiveMessage(frame.data);
        }
        return;
      }
      case 'resync': {
        if (streamMessageSchemas.resync.safeParse(data).success) {
          router.refresh();
        }
        return;
      }
      case 'status': {
        const frame = streamMessageSchemas.status.safeParse(data);

        if (frame.success) {
          getState().updateStatus(frame.data.chatId, frame.data.idMessage, frame.data.status);
        }
      }
    }
  }

  function handleStreamError(readyState: number) {
    if (store === null) {
      return;
    }

    // EventSource gives up after a non-2xx answer without telling 401 from 5xx, so the refresh
    // ends an expired session and the reopen outlives a restart of the server.
    if (readyState === EventSource.CLOSED) {
      const retryAt = Date.now() + getReopenDelay(reopenAttempt);
      store.getState().setConnection({ retryAt, status: 'reconnecting' });
      setPendingReopen({ retryAt, store });
      setReopenAttempt(reopenAttempt + 1);
      router.refresh();
    } else {
      store.getState().setConnection({ status: 'connecting' });
    }
  }

  useEventSource(streamUrl, STREAM_EVENT_NAMES, handleFrame, handleStreamError);

  const sessions = {
    ...parentSessions,
    [messengerId]: { isRealModeEnabled, loginReason, session, store },
  };

  return <MessengerSessionsContext value={sessions}>{children}</MessengerSessionsContext>;
}

export function useMessengerSession(messengerId: MessengerId) {
  const session = use(MessengerSessionsContext)[messengerId];

  if (session === undefined) {
    throw new Error(`MessengerSessionProvider for ${messengerId} is missing`);
  }

  return session;
}

export function useMessengerStore<Selected>(
  selector: (state: ExtractState<MessengerStore>) => Selected,
) {
  const store = use(MessengerStoreContext);

  if (store === null) {
    throw new Error('useMessengerStore must be used inside a signed-in SessionGate');
  }

  return useStore(store, selector);
}

export function useUnreadCount(messengerId: MessengerId) {
  return useSessionStoreSnapshot(messengerId, selectUnreadTotal, 0);
}

export function useSessionChats(messengerId: MessengerId) {
  return useSessionStoreSnapshot(messengerId, selectChats, NO_CHATS);
}

function useSessionStoreSnapshot<Selected>(
  messengerId: MessengerId,
  selector: (state: ExtractState<MessengerStore>) => Selected,
  fallback: Selected,
) {
  const { store } = useMessengerSession(messengerId);

  return useSyncExternalStore(
    (onStoreChange) => store?.subscribe(onStoreChange) ?? subscribeToNothing(),
    () => (store === null ? fallback : selector(store.getState())),
    () => fallback,
  );
}

function getReopenDelay(attempt: number) {
  return Math.min(MAX_REOPEN_DELAY_MS, BASE_REOPEN_DELAY_MS * 2 ** attempt);
}

function selectChats(state: ExtractState<MessengerStore>) {
  return state.chats;
}

function subscribeToNothing() {
  return () => undefined;
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}
