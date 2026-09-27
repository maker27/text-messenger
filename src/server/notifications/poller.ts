import 'server-only';

import { assign, createActor, fromPromise, setup } from 'xstate';

import type { MessengerConfig } from '@/entities/messenger/model';
import type { NotificationEvent } from '@/server/green-api/notification';
import { getLogger } from '@/server/logger';
import type { GreenApiError } from '@/shared/errors/model';

import { runReceiveCycle, type ReceiveClient, type ReceiveCycleOutcome } from './receive-cycle';

const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30_000;
const MS_PER_SECOND = 1000;

type StopCode = 'instanceTypeMismatch' | 'realModeDisabled' | 'webhookConfigured' | null;

export type ConnectionState =
  | { status: 'online' }
  | { retryAt: number; status: 'reconnecting' }
  | { status: 'unauthorized' }
  | { code: StopCode; status: 'stopped' };

interface PollerOptions {
  client: ReceiveClient;
  messenger: MessengerConfig;
  onConnection: (state: ConnectionState) => void;
  onEvent: (event: NotificationEvent) => void;
  random: () => number;
}

interface PollerContext {
  attempt: number;
  retryDelay: number;
  stopCode: StopCode;
}

interface StopEvent {
  type: 'STOP';
}

const INITIAL_CONTEXT: PollerContext = { attempt: 0, retryDelay: 0, stopCode: null };
const STOP_EVENT: StopEvent = { type: 'STOP' };

function getRetryDelay(error: GreenApiError | null, attempt: number, random: () => number) {
  if (error?.code === 'rateLimited' && error.retryAfter !== null) {
    return error.retryAfter * MS_PER_SECOND;
  }
  const ceiling = Math.min(MAX_RETRY_DELAY_MS, BASE_RETRY_DELAY_MS * 2 ** attempt);
  const halfCeiling = ceiling / 2;

  return Math.round(halfCeiling + random() * halfCeiling);
}

function getFailure(outcome: ReceiveCycleOutcome) {
  return outcome.type === 'failed' ? outcome.error : null;
}

function getStopCode(outcome: ReceiveCycleOutcome): StopCode {
  if (outcome.type === 'mismatch') {
    return 'instanceTypeMismatch';
  }
  return getFailure(outcome)?.code === 'webhookConfigured' ? 'webhookConfigured' : null;
}

function getErrorName(error: unknown) {
  return error instanceof Error ? error.name : typeof error;
}

export function startPoller({ client, messenger, onConnection, onEvent, random }: PollerOptions) {
  function getNextRetry(context: PollerContext, error: GreenApiError | null) {
    return {
      attempt: context.attempt + 1,
      retryDelay: getRetryDelay(error, context.attempt, random),
    };
  }

  const machine = setup({
    actors: {
      receive: fromPromise<ReceiveCycleOutcome>(({ signal }) =>
        runReceiveCycle(client, messenger, signal),
      ),
    },
    delays: {
      retry: ({ context }) => context.retryDelay,
    },
    types: { context: INITIAL_CONTEXT, events: STOP_EVENT },
  }).createMachine({
    context: INITIAL_CONTEXT,
    initial: 'polling',
    on: {
      STOP: { actions: assign({ stopCode: null }), target: '.stopped' },
    },
    states: {
      backoff: {
        after: { retry: 'polling' },
        entry: ({ context }) => {
          onConnection({ retryAt: Date.now() + context.retryDelay, status: 'reconnecting' });
        },
      },
      polling: {
        invoke: {
          onDone: [
            {
              guard: ({ event }) => getFailure(event.output)?.code === 'unauthorized',
              target: 'unauthorized',
            },
            {
              actions: assign({ stopCode: ({ event }) => getStopCode(event.output) }),
              guard: ({ event }) => getStopCode(event.output) !== null,
              target: 'stopped',
            },
            {
              actions: assign(({ context, event }) =>
                getNextRetry(context, getFailure(event.output)),
              ),
              guard: ({ event }) => event.output.type === 'failed',
              target: 'backoff',
            },
            {
              actions: [
                ({ context, event }) => {
                  if (context.attempt > 0) {
                    onConnection({ status: 'online' });
                  }
                  if (event.output.type === 'received' && event.output.event !== null) {
                    onEvent(event.output.event);
                  }
                },
                assign({ attempt: 0 }),
              ],
              reenter: true,
              target: 'polling',
            },
          ],
          onError: {
            actions: [
              ({ event }) => {
                getLogger().error(
                  { errorName: getErrorName(event.error), messenger: messenger.id },
                  'Notification polling failed unexpectedly',
                );
              },
              assign(({ context }) => getNextRetry(context, null)),
            ],
            target: 'backoff',
          },
          src: 'receive',
        },
      },
      stopped: {
        entry: ({ context }) => {
          onConnection({ code: context.stopCode, status: 'stopped' });
        },
        type: 'final',
      },
      unauthorized: {
        entry: () => {
          onConnection({ status: 'unauthorized' });
        },
        type: 'final',
      },
    },
  });

  const actor = createActor(machine).start();

  return {
    stop() {
      actor.send(STOP_EVENT);
    },
  };
}
