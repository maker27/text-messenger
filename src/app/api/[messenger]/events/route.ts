import { cookies } from 'next/headers';

import { messengerIdSchema } from '@/entities/messenger/model';
import { createClosedEventStream, createEventStream } from '@/server/notifications/event-stream';
import { pollerRegistry } from '@/server/notifications/poller-registry';
import { readSession } from '@/server/session/session';

const HttpStatus = {
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
} as const;

const LAST_EVENT_ID_PATTERN = /^\d+$/;

function readLastEventId(headers: Headers) {
  const lastEventId = headers.get('Last-Event-ID');

  return lastEventId !== null && LAST_EVENT_ID_PATTERN.test(lastEventId)
    ? Number(lastEventId)
    : null;
}

export async function GET(request: Request, { params }: RouteContext<'/api/[messenger]/events'>) {
  const messengerId = messengerIdSchema.safeParse((await params).messenger);
  if (!messengerId.success) {
    return new Response(null, { status: HttpStatus.NOT_FOUND });
  }

  const session = await readSession(await cookies(), messengerId.data);
  if (!session.ok) {
    return session.error.code === 'realModeDisabled'
      ? createClosedEventStream({
          state: { code: 'realModeDisabled', status: 'stopped' },
          type: 'connection',
        })
      : new Response(null, { status: HttpStatus.UNAUTHORIZED });
  }

  const lastEventId = readLastEventId(request.headers);
  return createEventStream(
    (listener) => pollerRegistry.subscribe(session.data, { ...listener, lastEventId }),
    request.signal,
  );
}
