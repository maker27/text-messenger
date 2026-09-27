import 'server-only';

import { createHmac } from 'node:crypto';

import { MESSENGERS } from '@/entities/messenger/config';
import { env } from '@/server/env';
import { createGreenApiClient } from '@/server/green-api/client';
import type { NotificationEvent } from '@/server/green-api/notification';
import type { Session } from '@/server/session/session';

import { createEventBuffer, type BufferedEvent } from './event-buffer';
import { startPoller, type ConnectionState } from './poller';

const EVENT_BUFFER_CAPACITY = 500;
const POLLER_STOP_DELAY_MS = 30_000;
const INITIAL_CONNECTION: ConnectionState = { status: 'online' };

export type StreamMessage =
  | { state: ConnectionState; type: 'connection' }
  | { event: BufferedEvent; type: 'event' }
  | { type: 'resync' };

interface Stream {
  close: () => void;
  send: (message: StreamMessage) => void;
}

interface SubscribeOptions extends Stream {
  lastEventId: number | null;
}

interface PollerEntry {
  buffer: ReturnType<typeof createEventBuffer>;
  connection: ConnectionState;
  joinSeqs: Map<string, number>;
  poller: ReturnType<typeof startPoller>;
  stopTimer: ReturnType<typeof setTimeout> | null;
  streamSessions: Map<Stream, string>;
}

interface PollerRegistryOptions {
  startPoller: typeof startPoller;
  stopDelayMs: number;
}

export function getPollerKey({ credentials, messengerId }: Session) {
  const tokenDigest = createHmac('sha256', env.SESSION_SECRET)
    .update(credentials.apiTokenInstance)
    .digest('hex');

  return `${messengerId}:${credentials.apiUrl}:${credentials.idInstance}:${tokenDigest}`;
}

function isFinalConnection(state: ConnectionState) {
  return state.status === 'stopped' || state.status === 'unauthorized';
}

function broadcast(entry: PollerEntry, message: StreamMessage) {
  for (const stream of entry.streamSessions.keys()) {
    stream.send(message);
  }
}

function cancelStop(entry: PollerEntry) {
  if (entry.stopTimer !== null) {
    clearTimeout(entry.stopTimer);
    entry.stopTimer = null;
  }
}

function replayEvents(entry: PollerEntry, stream: Stream, afterSeq: number) {
  const missedEvents = entry.buffer.readAfter(afterSeq);
  if (!missedEvents.ok) {
    stream.send({ type: 'resync' });
    return;
  }
  for (const event of missedEvents.data) {
    stream.send({ event, type: 'event' });
  }
}

export function createPollerRegistry({ startPoller, stopDelayMs }: PollerRegistryOptions) {
  const entries = new Map<string, PollerEntry>();

  function handleEvent(entry: PollerEntry, event: NotificationEvent) {
    const bufferedEvent = entry.buffer.append(event);
    if (bufferedEvent !== null) {
      broadcast(entry, { event: bufferedEvent, type: 'event' });
    }
  }

  function handleConnection(key: string, entry: PollerEntry, state: ConnectionState) {
    entry.connection = state;
    broadcast(entry, { state, type: 'connection' });
    if (!isFinalConnection(state)) {
      return;
    }

    cancelStop(entry);
    entries.delete(key);
    const streams = [...entry.streamSessions.keys()];
    entry.streamSessions.clear();
    for (const stream of streams) {
      stream.close();
    }
  }

  function startEntry(key: string, session: Session) {
    const messenger = MESSENGERS[session.messengerId];
    const entry: PollerEntry = {
      buffer: createEventBuffer(EVENT_BUFFER_CAPACITY),
      connection: INITIAL_CONNECTION,
      joinSeqs: new Map(),
      poller: startPoller({
        client: createGreenApiClient(messenger, session.credentials),
        messenger,
        onConnection: (state) => {
          handleConnection(key, entry, state);
        },
        onEvent: (event) => {
          handleEvent(entry, event);
        },
        random: Math.random,
      }),
      stopTimer: null,
      streamSessions: new Map(),
    };
    entries.set(key, entry);

    return entry;
  }

  function subscribe(session: Session, { close, lastEventId, send }: SubscribeOptions) {
    const key = getPollerKey(session);
    const entry = entries.get(key) ?? startEntry(key, session);
    const joinSeq = entry.joinSeqs.get(session.sessionId) ?? entry.buffer.lastSeq;
    const stream = { close, send };

    cancelStop(entry);
    entry.joinSeqs.set(session.sessionId, joinSeq);
    entry.streamSessions.set(stream, session.sessionId);
    send({ state: entry.connection, type: 'connection' });
    if (lastEventId !== null) {
      replayEvents(entry, stream, Math.max(lastEventId, joinSeq));
    }

    return () => {
      if (entry.streamSessions.delete(stream) && entry.streamSessions.size === 0) {
        entry.stopTimer = setTimeout(() => {
          entry.poller.stop();
        }, stopDelayMs);
      }
    };
  }

  function disconnectSession(session: Session) {
    const entry = entries.get(getPollerKey(session));
    if (entry === undefined) {
      return;
    }

    entry.joinSeqs.delete(session.sessionId);
    for (const [stream, sessionId] of entry.streamSessions) {
      if (sessionId === session.sessionId) {
        entry.streamSessions.delete(stream);
        stream.close();
      }
    }
    if (entry.streamSessions.size === 0) {
      entry.poller.stop();
    }
  }

  return { disconnectSession, subscribe };
}

export const pollerRegistry = createPollerRegistry({
  startPoller,
  stopDelayMs: POLLER_STOP_DELAY_MS,
});
