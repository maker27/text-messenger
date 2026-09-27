import { afterEach, beforeEach, expect, test } from 'vitest';

import { MESSENGERS } from '@/entities/messenger/config';

import { createGreenApiClient } from './client';
import { checkInstanceReadiness } from './instance-readiness';
import { createTestCredentials, startTestServer } from './test-server';

const AUTHORIZED_STATE = '{"stateInstance":"authorized"}';

let server: Awaited<ReturnType<typeof startTestServer>>;

function createScriptedClient(bodies: string[]) {
  const queue = [...bodies];
  const client = createGreenApiClient(MESSENGERS.whatsapp, createTestCredentials(server.origin));

  return {
    getSettings: () => {
      server.setReply({ body: queue.shift() ?? '', status: 200 });
      return client.getSettings();
    },
    getStateInstance: () => {
      server.setReply({ body: queue.shift() ?? '', status: 200 });
      return client.getStateInstance();
    },
  };
}

function createSettings({ incomingWebhook = 'yes', outgoingWebhook = 'yes', webhookUrl = '' }) {
  return JSON.stringify({ incomingWebhook, outgoingWebhook, webhookUrl });
}

beforeEach(async () => {
  server = await startTestServer();
});

afterEach(async () => {
  await server.close();
});

test('accepts an authorized instance that keeps notifications in the queue', async () => {
  const client = createScriptedClient([AUTHORIZED_STATE, createSettings({})]);

  expect(await checkInstanceReadiness(client)).toEqual({ data: null, ok: true });
});

test.each(['notAuthorized', 'blocked', 'starting', 'yellowCard'])(
  'rejects an instance in the %s state',
  async (stateInstance) => {
    const client = createScriptedClient([JSON.stringify({ stateInstance })]);

    expect(await checkInstanceReadiness(client)).toEqual({
      error: { code: 'instanceNotAuthorized' },
      ok: false,
    });
    expect(server.requests).toHaveLength(1);
  },
);

test('rejects an instance that sends notifications to a webhook', async () => {
  const client = createScriptedClient([
    AUTHORIZED_STATE,
    createSettings({ webhookUrl: 'https://example.com/hook' }),
  ]);

  expect(await checkInstanceReadiness(client)).toEqual({
    error: { code: 'webhookConfigured' },
    ok: false,
  });
});

test.each([{ incomingWebhook: 'no' }, { outgoingWebhook: 'no' }])(
  'rejects an instance with notifications disabled: %j',
  async (settings) => {
    const client = createScriptedClient([AUTHORIZED_STATE, createSettings(settings)]);

    expect(await checkInstanceReadiness(client)).toEqual({
      error: { code: 'notificationsDisabled' },
      ok: false,
    });
  },
);

test('passes a transport error through', async () => {
  const client = createGreenApiClient(MESSENGERS.whatsapp, createTestCredentials(server.origin));
  server.setReply({ body: '', status: 401 });

  expect(await checkInstanceReadiness(client)).toEqual({
    error: { code: 'unauthorized' },
    ok: false,
  });
});

test('passes a settings error through', async () => {
  const client = createScriptedClient([AUTHORIZED_STATE, '{"incomingWebhook":1}']);

  expect(await checkInstanceReadiness(client)).toEqual({
    error: { code: 'invalidResponse' },
    ok: false,
  });
});
