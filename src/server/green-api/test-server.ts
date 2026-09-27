import {
  createServer,
  type IncomingMessage,
  type OutgoingHttpHeaders,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import { text } from 'node:stream/consumers';
import { setTimeout } from 'node:timers/promises';

import type { Result } from '@/shared/errors/result';

import { createApiUrlSchema } from './api-url';
import { apiTokenInstanceSchema, idInstanceSchema, type GreenApiCredentials } from './credentials';

export const TEST_API_TOKEN_INSTANCE = 'd75b3a66374942c5b3c019c698abc2067e151558acbd412345';
export const TEST_ID_INSTANCE = '1101000001';

interface RecordedRequest {
  body: string;
  contentType: string | undefined;
  method: string | undefined;
  url: string | undefined;
}

interface TestReply {
  body: string;
  delayMs?: number;
  headers?: OutgoingHttpHeaders;
  isBodyDelayed?: boolean;
  status: number;
}

const DEFAULT_REPLY: TestReply = { body: '{}', status: 200 };

function isAddressInfo(address: string | AddressInfo | null): address is AddressInfo {
  return typeof address === 'object' && address !== null;
}

export function createTestCredentials(
  origin: string,
  idInstance = TEST_ID_INSTANCE,
): GreenApiCredentials {
  return {
    apiTokenInstance: apiTokenInstanceSchema.parse(TEST_API_TOKEN_INSTANCE),
    apiUrl: createApiUrlSchema({ isRealModeEnabled: false, mockUrl: origin }).parse(origin),
    idInstance: idInstanceSchema.parse(idInstance),
  };
}

export async function startTestServer() {
  const requests: RecordedRequest[] = [];
  let reply = DEFAULT_REPLY;

  async function handleRequest(request: IncomingMessage, response: ServerResponse) {
    requests.push({
      body: await text(request),
      contentType: request.headers['content-type'],
      method: request.method,
      url: request.url,
    });
    const { body, delayMs = 0, headers = {}, isBodyDelayed = false, status } = reply;
    if (isBodyDelayed) {
      response.writeHead(status, { 'Content-Type': 'application/json', ...headers }).flushHeaders();
    }
    await setTimeout(delayMs);
    if (response.destroyed) {
      return;
    }
    if (!isBodyDelayed) {
      response.writeHead(status, { 'Content-Type': 'application/json', ...headers });
    }
    response.end(body);
  }

  const server = createServer((request, response) => {
    void handleRequest(request, response);
  });
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!isAddressInfo(address)) {
    throw new Error('Test server is not listening on a TCP port');
  }

  return {
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
        server.closeAllConnections();
      }),
    origin: `http://127.0.0.1:${String(address.port)}`,
    requests,
    setReply: (nextReply: TestReply) => {
      reply = nextReply;
    },
  };
}

export function unwrapResult<T, E>(result: Result<T, E>): T {
  if (!result.ok) {
    throw new Error(`Expected a successful result, got ${JSON.stringify(result.error)}`);
  }
  return result.data;
}
