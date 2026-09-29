import 'server-only';

import type { GreenApiError } from '@/shared/errors/model';
import type { Result } from '@/shared/errors/result';

import type { createGreenApiClient } from './client';

const AUTHORIZED_STATE = 'authorized';

type ReadinessClient = Pick<
  ReturnType<typeof createGreenApiClient>,
  'getSettings' | 'getStateInstance'
>;

export async function checkInstanceReadiness(
  client: ReadinessClient,
): Promise<Result<null, GreenApiError>> {
  const state = await client.getStateInstance();
  if (!state.ok) {
    return state;
  }
  if (state.data !== AUTHORIZED_STATE) {
    return { error: { code: 'instanceNotAuthorized' }, ok: false };
  }

  const settings = await client.getSettings();
  if (!settings.ok) {
    return settings;
  }
  if (settings.data.isWebhookUrlSet) {
    return { error: { code: 'webhookConfigured' }, ok: false };
  }
  if (!settings.data.isIncomingWebhookEnabled) {
    return { error: { code: 'notificationsDisabled' }, ok: false };
  }

  return { data: null, ok: true };
}
