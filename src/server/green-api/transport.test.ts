import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { z } from 'zod';

import { getLogger } from '@/server/logger';

import {
  createTestCredentials,
  startTestServer,
  TEST_API_TOKEN_INSTANCE,
  TEST_ID_INSTANCE,
} from './test-server';
import { requestGreenApi } from './transport';

const STATE_SCHEMA = z.object({ stateInstance: z.string() });
const INSTANCE_PATH = `/waInstance${TEST_ID_INSTANCE}`;
const ERROR_BODY = JSON.stringify({
  message: 'Unauthorized',
  path: `${INSTANCE_PATH}/getStateInstance/${TEST_API_TOKEN_INSTANCE}`,
  statusCode: 401,
});

let server: Awaited<ReturnType<typeof startTestServer>>;

function getBaseRequest() {
  return { credentials: createTestCredentials(server.origin), messengerId: 'whatsapp' as const };
}

function requestState() {
  return requestGreenApi({ ...getBaseRequest(), method: 'getStateInstance', schema: STATE_SCHEMA });
}

beforeEach(async () => {
  server = await startTestServer();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await server.close();
});

test('sends a GET request to the instance method path', async () => {
  server.setReply({ body: '{"stateInstance":"authorized"}', status: 200 });

  const result = await requestState();

  expect(result).toEqual({ ok: true, data: { stateInstance: 'authorized' } });
  expect(server.requests).toEqual([
    {
      body: '',
      contentType: undefined,
      method: 'GET',
      url: `${INSTANCE_PATH}/getStateInstance/${TEST_API_TOKEN_INSTANCE}`,
    },
  ]);
});

test('sends a JSON body with POST', async () => {
  server.setReply({ body: '{"idMessage":"ABC"}', status: 200 });

  await requestGreenApi({
    ...getBaseRequest(),
    body: { chatId: '79161234567@c.us', message: 'Привет' },
    method: 'sendMessage',
    schema: z.object({ idMessage: z.string() }),
  });

  expect(server.requests).toEqual([
    {
      body: '{"chatId":"79161234567@c.us","message":"Привет"}',
      contentType: 'application/json',
      method: 'POST',
      url: `${INSTANCE_PATH}/sendMessage/${TEST_API_TOKEN_INSTANCE}`,
    },
  ]);
});

test('appends the path segment and search params', async () => {
  server.setReply({ body: '{"result":true}', status: 200 });

  await requestGreenApi({
    ...getBaseRequest(),
    method: 'deleteNotification',
    pathSegment: '42',
    schema: z.object({ result: z.boolean() }),
  });
  await requestGreenApi({
    ...getBaseRequest(),
    method: 'receiveNotification',
    schema: z.null(),
    searchParams: { receiveTimeout: '20' },
  });

  expect(server.requests.map(({ method, url }) => ({ method, url }))).toEqual([
    { method: 'DELETE', url: `${INSTANCE_PATH}/deleteNotification/${TEST_API_TOKEN_INSTANCE}/42` },
    {
      method: 'GET',
      url: `${INSTANCE_PATH}/receiveNotification/${TEST_API_TOKEN_INSTANCE}?receiveTimeout=20`,
    },
  ]);
});

test.each([
  [401, {}, { code: 'unauthorized' }],
  [403, {}, { code: 'unauthorized' }],
  [429, { 'Retry-After': '7' }, { code: 'rateLimited', retryAfter: 7 }],
  [
    429,
    { 'Retry-After': 'Wed, 21 Oct 2026 07:28:00 GMT' },
    { code: 'rateLimited', retryAfter: null },
  ],
  [469, {}, { code: 'rateLimited', retryAfter: null }],
  [400, {}, { code: 'upstream' }],
  [500, {}, { code: 'upstream' }],
])('maps HTTP %i with headers %o to %o', async (status, headers, error) => {
  server.setReply({ body: ERROR_BODY, headers, status });

  expect(await requestState()).toEqual({ ok: false, error });
});

test('maps HTTP 400 on receiveNotification to a configured webhook', async () => {
  server.setReply({ body: ERROR_BODY, status: 400 });

  const result = await requestGreenApi({
    ...getBaseRequest(),
    method: 'receiveNotification',
    schema: z.null(),
  });

  expect(result).toEqual({ ok: false, error: { code: 'webhookConfigured' } });
});

test.each(['<html></html>', '', '{"stateInstance":1}'])(
  'reports an invalid response for body %j',
  async (body) => {
    server.setReply({ body, status: 200 });

    expect(await requestState()).toEqual({ ok: false, error: { code: 'invalidResponse' } });
  },
);

test('refuses to follow redirects', async () => {
  server.setReply({ body: '', headers: { Location: '/elsewhere' }, status: 302 });

  expect(await requestState()).toEqual({ ok: false, error: { code: 'network' } });
  expect(server.requests).toHaveLength(1);
});

test('times out a slow upstream', async () => {
  server.setReply({ body: '{"stateInstance":"authorized"}', delayMs: 200, status: 200 });

  const result = await requestGreenApi({
    ...getBaseRequest(),
    method: 'getStateInstance',
    schema: STATE_SCHEMA,
    timeoutMs: 50,
  });

  expect(result).toEqual({ ok: false, error: { code: 'timeout' } });
});

test('times out an upstream that stalls after the headers', async () => {
  server.setReply({
    body: '{"stateInstance":"authorized"}',
    delayMs: 200,
    isBodyDelayed: true,
    status: 200,
  });

  const result = await requestGreenApi({
    ...getBaseRequest(),
    method: 'getStateInstance',
    schema: STATE_SCHEMA,
    timeoutMs: 50,
  });

  expect(result).toEqual({ ok: false, error: { code: 'timeout' } });
});

test('rethrows a caller abort', async () => {
  server.setReply({ body: '{"stateInstance":"authorized"}', delayMs: 200, status: 200 });
  const controller = new AbortController();

  const pending = requestGreenApi({
    ...getBaseRequest(),
    method: 'getStateInstance',
    schema: STATE_SCHEMA,
    signal: controller.signal,
  });
  controller.abort();

  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
});

test('reports a network error when the upstream is unreachable', async () => {
  const closedServer = await startTestServer();
  await closedServer.close();

  const result = await requestGreenApi({
    credentials: createTestCredentials(closedServer.origin),
    messengerId: 'whatsapp',
    method: 'getStateInstance',
    schema: STATE_SCHEMA,
  });

  expect(result).toEqual({ ok: false, error: { code: 'network' } });
});

test('logs a failure without the token or the URL', async () => {
  const warn = vi.spyOn(getLogger(), 'warn');
  server.setReply({ body: ERROR_BODY, status: 401 });

  await requestState();

  expect(warn).toHaveBeenCalledWith(
    { code: 'unauthorized', messenger: 'whatsapp', method: 'getStateInstance', status: 401 },
    'GREEN-API request failed',
  );
  expect(JSON.stringify(warn.mock.calls)).not.toContain(TEST_API_TOKEN_INSTANCE);
});
