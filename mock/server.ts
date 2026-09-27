import type { AddressInfo } from 'node:net';

import { createMockServer } from './create-mock-server.ts';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 3100;
const DEFAULT_REPLY_DELAY_MS = 1500;
const DEFAULT_STATUS_DELAY_MS = 500;
const SHUTDOWN_SIGNALS = ['SIGINT', 'SIGTERM'] as const;

function readNumber(name: string, defaultValue: number) {
  const value = process.env[name];
  if (value === undefined) {
    return defaultValue;
  }
  const number = Number(value);
  if (value === '' || !Number.isInteger(number) || number < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return number;
}

function isAddressInfo(address: string | AddressInfo | null): address is AddressInfo {
  return typeof address === 'object' && address !== null;
}

const host = process.env.HOST ?? DEFAULT_HOST;
const { close, server } = createMockServer({
  replyDelayMs: readNumber('REPLY_DELAY_MS', DEFAULT_REPLY_DELAY_MS),
  statusDelayMs: readNumber('STATUS_DELAY_MS', DEFAULT_STATUS_DELAY_MS),
});

server.listen(readNumber('PORT', DEFAULT_PORT), host, () => {
  const address = server.address();
  if (!isAddressInfo(address)) {
    throw new Error('Mock server is not listening on a TCP port');
  }
  process.stdout.write(`green-api-mock listening on http://${host}:${String(address.port)}\n`);
});

for (const signal of SHUTDOWN_SIGNALS) {
  process.once(signal, () => {
    void close();
  });
}
