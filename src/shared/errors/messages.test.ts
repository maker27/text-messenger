import { expect, test } from 'vitest';

import { getGreenApiErrorMessage, getPhoneNumberErrorMessage } from './messages';
import type { GreenApiError } from './model';

const FAILURE_CODES = [
  'accountNotFound',
  'instanceTypeMismatch',
  'invalidResponse',
  'network',
  'notificationsDisabled',
  'realModeDisabled',
  'timeout',
  'unauthorized',
  'upstream',
  'webhookConfigured',
] as const satisfies readonly Exclude<GreenApiError['code'], 'rateLimited'>[];

test.each(FAILURE_CODES)('has a message for %s', (code) => {
  expect(getGreenApiErrorMessage({ code }, 'MAX')).not.toBe('');
});

test('names the messenger when the account is not found', () => {
  expect(getGreenApiErrorMessage({ code: 'accountNotFound' }, 'Telegram')).toBe(
    'Номер не зарегистрирован в Telegram',
  );
});

test('shows the retry delay when it is known', () => {
  expect(getGreenApiErrorMessage({ code: 'rateLimited', retryAfter: 7 }, 'MAX')).toBe(
    'Слишком много запросов. Повторите через 7 с',
  );
});

test('asks to wait when the retry delay is unknown', () => {
  expect(getGreenApiErrorMessage({ code: 'rateLimited', retryAfter: null }, 'MAX')).toBe(
    'Слишком много запросов. Подождите немного и повторите',
  );
});

test('explains the expected phone number format', () => {
  expect(getPhoneNumberErrorMessage('invalid', 'WhatsApp')).toBe(
    'Введите номер телефона в международном формате, например +7 916 123-45-67',
  );
});

test('names the messenger when the country is not allowed', () => {
  expect(getPhoneNumberErrorMessage('countryNotAllowed', 'MAX')).toBe(
    'MAX не работает с номерами этой страны',
  );
});
