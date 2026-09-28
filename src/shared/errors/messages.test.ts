import { expect, test } from 'vitest';

import {
  getGreenApiErrorMessage,
  getLoginFieldErrorMessage,
  getLoginReasonMessage,
  getPhoneNumberErrorMessage,
} from './messages';
import type { GreenApiError, LoginField } from './model';

const FAILURE_CODES = [
  'accountNotFound',
  'instanceNotAuthorized',
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

const LOGIN_FIELDS = [
  'apiTokenInstance',
  'apiUrl',
  'consent',
  'idInstance',
] as const satisfies readonly LoginField[];

test.each(FAILURE_CODES)('has a message for %s', (code) => {
  expect(getGreenApiErrorMessage({ code }, 'MAX')).not.toBe('');
});

test('names the messenger when the account is not found', () => {
  expect(getGreenApiErrorMessage({ code: 'accountNotFound' }, 'Telegram')).toBe(
    'Номер не зарегистрирован в Telegram',
  );
});

test('points to the account dashboard when the instance is not authorized', () => {
  expect(getGreenApiErrorMessage({ code: 'instanceNotAuthorized' }, 'MAX')).toBe(
    'Инстанс не авторизован. Отсканируйте QR-код или авторизуйте его в личном кабинете GREEN-API',
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

test('asks to sign in again when the session expired', () => {
  expect(getLoginReasonMessage('sessionExpired', 'MAX')).toBe('Сессия истекла. Войдите снова');
});

test('reuses the GREEN-API texts for stopped sessions', () => {
  expect(getLoginReasonMessage('instanceTypeMismatch', 'Telegram')).toBe(
    getGreenApiErrorMessage({ code: 'instanceTypeMismatch' }, 'Telegram'),
  );
  expect(getLoginReasonMessage('realModeDisabled', 'MAX')).toBe(
    getGreenApiErrorMessage({ code: 'realModeDisabled' }, 'MAX'),
  );
});

test.each(LOGIN_FIELDS)('has a message for the invalid %s field', (field) => {
  expect(getLoginFieldErrorMessage(field)).not.toBe('');
});
