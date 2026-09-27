import 'server-only';

import type { NotificationEvent } from '@/server/green-api/notification';

import type { StreamMessage } from './poller-registry';

const HEARTBEAT_INTERVAL_MS = 15_000;
const HEARTBEAT_FRAME = ': ping\n\n';
const EVENT_STREAM_HEADERS = {
  'Cache-Control': 'no-store, no-transform',
  'Content-Type': 'text/event-stream; charset=utf-8',
  'X-Accel-Buffering': 'no',
};

interface StreamListener {
  close: () => void;
  send: (message: StreamMessage) => void;
}

type Subscribe = (listener: StreamListener) => () => void;

function formatFrame(name: string, data: unknown) {
  return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
}

function formatNotification(event: NotificationEvent) {
  if (event.type === 'status') {
    const { chatId, idMessage, status } = event;
    return formatFrame('status', { chatId, idMessage, status });
  }
  const { chatId, direction, idMessage, senderName, sentAt, text } = event.message;
  return formatFrame('message', { chatId, direction, idMessage, senderName, sentAt, text });
}

function formatMessage(message: StreamMessage) {
  if (message.type === 'connection') {
    return formatFrame('connection', message.state);
  }
  if (message.type === 'resync') {
    return formatFrame('resync', {});
  }
  return `id: ${String(message.event.seq)}\n${formatNotification(message.event.event)}`;
}

export function createEventStream(subscribe: Subscribe, signal: AbortSignal) {
  const encoder = new TextEncoder();
  let release: () => void = () => undefined;

  const body = new ReadableStream<Uint8Array>({
    cancel() {
      release();
    },
    start(controller) {
      let isOpen = true;

      function write(frame: string) {
        if (isOpen) {
          controller.enqueue(encoder.encode(frame));
        }
      }

      function close() {
        if (isOpen) {
          release();
          controller.close();
        }
      }

      if (signal.aborted) {
        controller.close();
        return;
      }
      const heartbeatTimer = setInterval(() => {
        write(HEARTBEAT_FRAME);
      }, HEARTBEAT_INTERVAL_MS);
      const unsubscribe = subscribe({
        close,
        send: (message) => {
          write(formatMessage(message));
        },
      });
      release = () => {
        isOpen = false;
        clearInterval(heartbeatTimer);
        signal.removeEventListener('abort', close);
        unsubscribe();
      };
      signal.addEventListener('abort', close);
    },
  });

  return new Response(body, { headers: EVENT_STREAM_HEADERS });
}

export function createClosedEventStream(message: StreamMessage) {
  return new Response(formatMessage(message), { headers: EVENT_STREAM_HEADERS });
}
