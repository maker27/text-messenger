import { randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { text } from 'node:stream/consumers';

import { z } from 'zod';

import { createInstanceStore, type MockHistoryEntry, type MockInstance } from './instance-store.ts';
import { findMockMessenger, type MockMessenger } from './messengers.ts';

const HttpStatus = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  LENGTH_REQUIRED: 411,
  PAYLOAD_TOO_LARGE: 413,
  INTERNAL_SERVER_ERROR: 500,
} as const;

const METHOD_HTTP_VERBS = new Map([
  ['checkAccount', 'POST'],
  ['checkWhatsapp', 'POST'],
  ['deleteNotification', 'DELETE'],
  ['getChatHistory', 'POST'],
  ['getSettings', 'GET'],
  ['getStateInstance', 'GET'],
  ['receiveNotification', 'GET'],
  ['sendMessage', 'POST'],
]);
const CHAT_ID_METHODS = new Set(['checkAccount', 'checkWhatsapp']);

const ROUTE_PATTERN =
  /^\/waInstance(?<idInstance>\d+)\/(?<method>\w+)\/(?<apiTokenInstance>[^/]+)(?:\/(?<receiptId>\d+))?$/;
const TOKEN_PATTERN = /^[A-Za-z0-9]+$/;
const RECEIVE_TIMEOUT_PATTERN = /^\d+$/;
const REQUEST_BASE_URL = 'http://mock.local';
const MAX_BODY_BYTES = 100 * 1024;
const MAX_INSTANCES = 1000;
const MAX_NOTIFICATIONS = 100;
const MAX_HISTORY_ENTRIES = 500;
const DEFAULT_HISTORY_COUNT = 100;
const MESSAGE_ID_BYTES = 10;
const MILLISECONDS_IN_SECOND = 1000;
const ReceiveTimeoutSeconds = { DEFAULT: 5, MAX: 60, MIN: 5 } as const;
const MISSING_ACCOUNT_SUFFIX = '0000';
const ECHO_SENDER_NAME = 'Эхо-бот';
const ECHO_PREFIX = 'Эхо: ';
const INSTANCE_STATE = { stateInstance: 'authorized' };
const INSTANCE_SETTINGS = { incomingWebhook: 'yes', outgoingWebhook: 'yes', webhookUrl: '' };

const routeSchema = z.object({
  apiTokenInstance: z.string(),
  idInstance: z.string(),
  method: z.string(),
  receiptId: z.string().optional(),
});
const phoneBodySchema = z.object({ phoneNumber: z.int().positive() });
const sendMessageBodySchema = z.object({ chatId: z.string().min(1), message: z.string().min(1) });
const chatHistoryBodySchema = z.object({
  chatId: z.string().min(1),
  count: z.int().positive().optional(),
});

interface MockReply {
  body: unknown;
  status: number;
}

interface MockRequestContext {
  instance: MockInstance;
  path: string;
  receiptId: string | undefined;
  request: IncomingMessage;
  response: ServerResponse;
  searchParams: URLSearchParams;
}

interface MockServerOptions {
  replyDelayMs: number;
  statusDelayMs: number;
}

type BodyResult<T> = { ok: true; data: T } | { ok: false; reply: MockReply };

function createReply(body: unknown): MockReply {
  return { body, status: HttpStatus.OK };
}

function createErrorReply(status: number, path: string, message: string): MockReply {
  return {
    body: { message, path, statusCode: status, timestamp: new Date().toISOString() },
    status,
  };
}

function getTimestamp() {
  return Math.floor(Date.now() / MILLISECONDS_IN_SECOND);
}

function createMessageId() {
  return randomBytes(MESSAGE_ID_BYTES).toString('hex').toUpperCase();
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

async function readBody<Schema extends z.ZodType>(
  request: IncomingMessage,
  path: string,
  schema: Schema,
): Promise<BodyResult<z.output<Schema>>> {
  const contentLength = request.headers['content-length'];
  // Node's parser never reads past Content-Length, so checking the header bounds the buffered body.
  if (contentLength === undefined) {
    request.resume();
    return {
      ok: false,
      reply: createErrorReply(HttpStatus.LENGTH_REQUIRED, path, 'Length Required'),
    };
  }
  if (Number(contentLength) > MAX_BODY_BYTES) {
    request.resume();
    return {
      ok: false,
      reply: createErrorReply(HttpStatus.PAYLOAD_TOO_LARGE, path, 'Payload Too Large'),
    };
  }
  const raw = await text(request);
  const parsed = schema.safeParse(parseJson(raw));
  return parsed.success
    ? { ok: true, data: parsed.data }
    : { ok: false, reply: createErrorReply(HttpStatus.BAD_REQUEST, path, 'Bad Request') };
}

function isMethodSupported(method: string, messenger: MockMessenger) {
  return (
    METHOD_HTTP_VERBS.has(method) &&
    (!CHAT_ID_METHODS.has(method) || method === messenger.chatIdMethod)
  );
}

function parseReceiveTimeout(value: string | null) {
  if (value === null) {
    return ReceiveTimeoutSeconds.DEFAULT;
  }
  const seconds = Number(value);
  return RECEIVE_TIMEOUT_PATTERN.test(value) &&
    seconds >= ReceiveTimeoutSeconds.MIN &&
    seconds <= ReceiveTimeoutSeconds.MAX
    ? seconds
    : null;
}

function lookupAccount(messenger: MockMessenger, phoneNumber: number) {
  const phone = String(phoneNumber);
  const isSupported = messenger.phonePattern.test(phone);
  const isFound = isSupported && !phone.endsWith(MISSING_ACCOUNT_SUFFIX);
  if (messenger.chatIdMethod === 'checkWhatsapp') {
    return isFound ? { chatId: `${phone}@c.us`, existsWhatsapp: true } : { existsWhatsapp: false };
  }
  if (!isSupported) {
    return { reason: 'Phone number is not supported', status: false };
  }
  return isFound ? { chatId: phone, exist: true } : { exist: false };
}

function addHistoryEntry(instance: MockInstance, entry: MockHistoryEntry) {
  instance.history.push(entry);
  if (instance.history.length > MAX_HISTORY_ENTRIES) {
    instance.history.shift();
  }
}

function getChatHistory(
  instance: MockInstance,
  { chatId, count = DEFAULT_HISTORY_COUNT }: z.output<typeof chatHistoryBodySchema>,
) {
  return instance.history
    .filter((entry) => entry.chatId === chatId)
    .reverse()
    .slice(0, count);
}

function pushNotification(instance: MockInstance, body: Record<string, unknown>) {
  // The real queue advances only on deleteNotification, so a full queue drops new events, not its head.
  if (instance.notifications.length >= MAX_NOTIFICATIONS) {
    return;
  }
  instance.notifications.push({
    body: { ...body, instanceData: { typeInstance: instance.messenger.typeInstance } },
    receiptId: instance.nextReceiptId,
  });
  instance.nextReceiptId += 1;
  for (const wake of instance.waiters) {
    wake();
  }
}

function deleteNotification(instance: MockInstance, receiptId: number) {
  const index = instance.notifications.findIndex(
    (notification) => notification.receiptId === receiptId,
  );
  if (index === -1) {
    return { reason: 'Notification not found', result: false };
  }
  instance.notifications.splice(index, 1);
  return { result: true };
}

function sendEchoReply(instance: MockInstance, chatId: string, message: string) {
  const entry: MockHistoryEntry = {
    chatId,
    idMessage: createMessageId(),
    senderName: ECHO_SENDER_NAME,
    textMessage: `${ECHO_PREFIX}${message}`,
    timestamp: getTimestamp(),
    type: 'incoming',
    typeMessage: 'textMessage',
  };
  addHistoryEntry(instance, entry);
  pushNotification(instance, {
    idMessage: entry.idMessage,
    messageData: {
      textMessageData: { textMessage: entry.textMessage },
      typeMessage: 'textMessage',
    },
    senderData: {
      chatId,
      chatName: ECHO_SENDER_NAME,
      sender: chatId,
      senderName: ECHO_SENDER_NAME,
    },
    timestamp: entry.timestamp,
    typeWebhook: 'incomingMessageReceived',
  });
}

function waitForNotification(instance: MockInstance, response: ServerResponse, timeoutMs: number) {
  return new Promise<void>((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      instance.waiters.delete(finish);
      response.off('close', finish);
      resolve();
    };
    const timer = setTimeout(finish, timeoutMs);
    instance.waiters.add(finish);
    response.once('close', finish);
  });
}

async function receiveNotification({ instance, path, response, searchParams }: MockRequestContext) {
  const timeoutSeconds = parseReceiveTimeout(searchParams.get('receiveTimeout'));
  if (timeoutSeconds === null) {
    return createErrorReply(HttpStatus.BAD_REQUEST, path, 'Bad Request');
  }
  if (instance.notifications.length === 0) {
    await waitForNotification(instance, response, timeoutSeconds * MILLISECONDS_IN_SECOND);
  }
  return createReply(instance.notifications[0] ?? null);
}

export function createMockServer({ replyDelayMs, statusDelayMs }: MockServerOptions) {
  const store = createInstanceStore(MAX_INSTANCES);
  const timers = new Set<ReturnType<typeof setTimeout>>();

  function schedule(delayMs: number, callback: () => void) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delayMs);
    timers.add(timer);
  }

  function sendMessage(
    instance: MockInstance,
    { chatId, message }: z.output<typeof sendMessageBodySchema>,
  ) {
    const entry: MockHistoryEntry = {
      chatId,
      idMessage: createMessageId(),
      textMessage: message,
      timestamp: getTimestamp(),
      type: 'outgoing',
      typeMessage: 'textMessage',
    };
    addHistoryEntry(instance, entry);
    instance.messenger.statuses.forEach((status, index) => {
      schedule(statusDelayMs * (index + 1), () => {
        entry.statusMessage = status;
        pushNotification(instance, {
          chatId,
          idMessage: entry.idMessage,
          sendByApi: true,
          status,
          timestamp: getTimestamp(),
          typeWebhook: 'outgoingMessageStatus',
        });
      });
    });
    schedule(replyDelayMs, () => {
      sendEchoReply(instance, chatId, message);
    });
    return { idMessage: entry.idMessage };
  }

  async function handleMethod(method: string, context: MockRequestContext): Promise<MockReply> {
    const { instance, path, request } = context;
    switch (method) {
      case 'checkAccount':
      case 'checkWhatsapp': {
        const body = await readBody(request, path, phoneBodySchema);
        return body.ok
          ? createReply(lookupAccount(instance.messenger, body.data.phoneNumber))
          : body.reply;
      }
      case 'deleteNotification':
        return createReply(deleteNotification(instance, Number(context.receiptId)));
      case 'getChatHistory': {
        const body = await readBody(request, path, chatHistoryBodySchema);
        return body.ok ? createReply(getChatHistory(instance, body.data)) : body.reply;
      }
      case 'getSettings':
        return createReply(INSTANCE_SETTINGS);
      case 'getStateInstance':
        return createReply(INSTANCE_STATE);
      case 'receiveNotification':
        return receiveNotification(context);
      case 'sendMessage': {
        const body = await readBody(request, path, sendMessageBodySchema);
        return body.ok ? createReply(sendMessage(instance, body.data)) : body.reply;
      }
      default:
        return createErrorReply(HttpStatus.NOT_FOUND, path, 'Not Found');
    }
  }

  async function routeRequest(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<MockReply> {
    const { pathname: path, searchParams } = new URL(request.url ?? '/', REQUEST_BASE_URL);
    const route = routeSchema.safeParse(ROUTE_PATTERN.exec(path)?.groups);
    if (!route.success) {
      return createErrorReply(HttpStatus.NOT_FOUND, path, 'Not Found');
    }
    const { apiTokenInstance, idInstance, method, receiptId } = route.data;
    const messenger = findMockMessenger(idInstance);
    if (messenger === null) {
      return createErrorReply(HttpStatus.FORBIDDEN, path, 'Forbidden');
    }
    if (!TOKEN_PATTERN.test(apiTokenInstance)) {
      return createErrorReply(HttpStatus.BAD_REQUEST, path, 'Bad Request');
    }
    const instance = store.authorize(idInstance, messenger, apiTokenInstance);
    if (instance === null) {
      return createErrorReply(HttpStatus.UNAUTHORIZED, path, 'Unauthorized');
    }
    const hasReceiptId = receiptId !== undefined;
    if (
      !isMethodSupported(method, messenger) ||
      hasReceiptId !== (method === 'deleteNotification')
    ) {
      return createErrorReply(HttpStatus.NOT_FOUND, path, 'Not Found');
    }
    if (request.method !== METHOD_HTTP_VERBS.get(method)) {
      return createErrorReply(HttpStatus.METHOD_NOT_ALLOWED, path, 'Method Not Allowed');
    }
    return handleMethod(method, { instance, path, receiptId, request, response, searchParams });
  }

  async function handleRequest(request: IncomingMessage, response: ServerResponse) {
    const reply = await routeRequest(request, response).catch((error: unknown) => {
      process.stderr.write(`green-api-mock: ${String(error)}\n`);
      return createErrorReply(HttpStatus.INTERNAL_SERVER_ERROR, '', 'Internal Server Error');
    });
    if (response.destroyed) {
      return;
    }
    response
      .writeHead(reply.status, { 'Content-Type': 'application/json' })
      .end(JSON.stringify(reply.body));
  }

  const server = createServer((request, response) => {
    void handleRequest(request, response);
  });

  return {
    close: () =>
      new Promise<void>((resolve, reject) => {
        for (const timer of timers) {
          clearTimeout(timer);
        }
        timers.clear();
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
        server.closeAllConnections();
      }),
    server,
  };
}
