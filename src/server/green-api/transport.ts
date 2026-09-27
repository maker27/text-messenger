import 'server-only';

import type { z } from 'zod';

import type { MessengerId } from '@/entities/messenger/model';
import { logger } from '@/server/logger';
import type { GreenApiError } from '@/shared/errors/model';
import type { Result } from '@/shared/errors/result';

import type { GreenApiCredentials } from './credentials';

const METHOD_HTTP_VERBS = {
  checkAccount: 'POST',
  checkWhatsapp: 'POST',
  deleteNotification: 'DELETE',
  getChatHistory: 'POST',
  getSettings: 'GET',
  getStateInstance: 'GET',
  receiveNotification: 'GET',
  sendMessage: 'POST',
} as const;

const HttpStatus = {
  BAD_REQUEST: 400,
  CHECK_LIMIT_EXCEEDED: 469,
  FORBIDDEN: 403,
  TOO_MANY_REQUESTS: 429,
  UNAUTHORIZED: 401,
} as const;

const DEFAULT_TIMEOUT_MS = 10_000;
const RETRY_AFTER_PATTERN = /^\d+$/;
const INVALID_RESPONSE: Result<never, GreenApiError> = {
  ok: false,
  error: { code: 'invalidResponse' },
};

type GreenApiMethod = keyof typeof METHOD_HTTP_VERBS;

interface GreenApiRequest<Schema extends z.ZodType> {
  body?: Record<string, unknown>;
  credentials: GreenApiCredentials;
  messengerId: MessengerId;
  method: GreenApiMethod;
  pathSegment?: string;
  schema: Schema;
  searchParams?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
}

interface RequestFailure {
  error: GreenApiError;
  status: number | null;
}

function buildUrl({ credentials, method, pathSegment, searchParams }: GreenApiRequest<z.ZodType>) {
  const { apiTokenInstance, apiUrl, idInstance } = credentials;
  const segments = [`waInstance${idInstance}`, method, apiTokenInstance];
  if (pathSegment !== undefined) {
    segments.push(pathSegment);
  }
  const url = new URL(`${apiUrl}/${segments.map(encodeURIComponent).join('/')}`);
  url.search = new URLSearchParams(searchParams).toString();
  return url;
}

function createSignal(signal: AbortSignal | undefined, timeoutMs: number) {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  return signal === undefined ? timeoutSignal : AbortSignal.any([signal, timeoutSignal]);
}

function readRetryAfter(headers: Headers) {
  const value = headers.get('Retry-After');
  return value !== null && RETRY_AFTER_PATTERN.test(value) ? Number(value) : null;
}

function mapHttpStatus(response: Response, method: GreenApiMethod): GreenApiError {
  switch (response.status) {
    case HttpStatus.UNAUTHORIZED:
    case HttpStatus.FORBIDDEN:
      return { code: 'unauthorized' };
    case HttpStatus.TOO_MANY_REQUESTS:
    case HttpStatus.CHECK_LIMIT_EXCEEDED:
      return { code: 'rateLimited', retryAfter: readRetryAfter(response.headers) };
    case HttpStatus.BAD_REQUEST:
      return { code: method === 'receiveNotification' ? 'webhookConfigured' : 'upstream' };
    default:
      return { code: 'upstream' };
  }
}

function mapFetchError(error: unknown, signal: AbortSignal | undefined): GreenApiError {
  signal?.throwIfAborted();
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return { code: 'timeout' };
  }
  if (error instanceof TypeError) {
    return { code: 'network' };
  }
  throw error;
}

function parseJson(text: string): Result<unknown, GreenApiError> {
  try {
    const data: unknown = JSON.parse(text);
    return { ok: true, data };
  } catch {
    return INVALID_RESPONSE;
  }
}

function parseResponse<Schema extends z.ZodType>(
  text: string,
  schema: Schema,
): Result<z.output<Schema>, GreenApiError> {
  const json = parseJson(text);
  if (!json.ok) {
    return json;
  }
  const parsed = schema.safeParse(json.data);
  return parsed.success ? { ok: true, data: parsed.data } : INVALID_RESPONSE;
}

async function sendRequest<Schema extends z.ZodType>(
  request: GreenApiRequest<Schema>,
): Promise<Result<z.output<Schema>, RequestFailure>> {
  const { body, method, schema, signal, timeoutMs = DEFAULT_TIMEOUT_MS } = request;
  try {
    const response = await fetch(buildUrl(request), {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      method: METHOD_HTTP_VERBS[method],
      redirect: 'error',
      signal: createSignal(signal, timeoutMs),
    });
    if (!response.ok) {
      // The error body echoes the request path, which contains the token.
      await response.body?.cancel();
      return {
        ok: false,
        error: { error: mapHttpStatus(response, method), status: response.status },
      };
    }
    const parsed = parseResponse(await response.text(), schema);
    return parsed.ok
      ? parsed
      : { ok: false, error: { error: parsed.error, status: response.status } };
  } catch (error) {
    return { ok: false, error: { error: mapFetchError(error, signal), status: null } };
  }
}

export async function requestGreenApi<Schema extends z.ZodType>(
  request: GreenApiRequest<Schema>,
): Promise<Result<z.output<Schema>, GreenApiError>> {
  const result = await sendRequest(request);
  if (result.ok) {
    return result;
  }
  const { error, status } = result.error;
  logger.warn(
    { code: error.code, messenger: request.messengerId, method: request.method, status },
    'GREEN-API request failed',
  );
  return { ok: false, error };
}
