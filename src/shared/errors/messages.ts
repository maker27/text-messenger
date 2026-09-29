import type { GreenApiError, LoginField, LoginReason, PhoneNumberErrorCode } from './model';

const GREEN_API_ERROR_MESSAGES = {
  accountNotFound: (messengerTitle) => `Номер не зарегистрирован в ${messengerTitle}`,
  instanceNotAuthorized: () =>
    'Инстанс не авторизован. Отсканируйте QR-код или авторизуйте его в личном кабинете GREEN-API',
  instanceTypeMismatch: (messengerTitle) => `Этот инстанс не относится к ${messengerTitle}`,
  invalidResponse: () => 'Сервис GREEN-API вернул неожиданный ответ. Повторите позже',
  network: () => 'Нет связи с GREEN-API. Проверьте подключение и повторите',
  notificationsDisabled: () =>
    'Включите получение входящих сообщений в настройках инстанса в личном кабинете',
  realModeDisabled: () => 'Реальный режим отключён, доступна демо-версия',
  timeout: () => 'GREEN-API не ответил вовремя. Повторите попытку',
  unauthorized: () => 'Неверный idInstance или apiTokenInstance',
  upstream: () => 'GREEN-API вернул ошибку. Повторите позже',
  webhookConfigured: () =>
    'Для инстанса задан webhook URL. Очистите его в личном кабинете, чтобы получать сообщения',
} satisfies Record<
  Exclude<GreenApiError['code'], 'rateLimited'>,
  (messengerTitle: string) => string
>;

export function getGreenApiErrorMessage(error: GreenApiError, messengerTitle: string) {
  if (error.code !== 'rateLimited') {
    return GREEN_API_ERROR_MESSAGES[error.code](messengerTitle);
  }
  return error.retryAfter === null
    ? 'Слишком много запросов. Подождите немного и повторите'
    : `Слишком много запросов. Повторите через ${String(error.retryAfter)} с`;
}

export function getPhoneNumberErrorMessage(code: PhoneNumberErrorCode, messengerTitle: string) {
  return code === 'invalid'
    ? 'Введите номер телефона в международном формате, например +7 916 123-45-67'
    : `${messengerTitle} не работает с номерами этой страны`;
}

const LOGIN_FIELD_ERROR_MESSAGES = {
  apiTokenInstance: 'Введите apiTokenInstance из личного кабинета GREEN-API',
  apiUrl: 'Укажите адрес API из личного кабинета GREEN-API',
  consent: 'Подтвердите согласие на обработку персональных данных',
  idInstance: 'Введите idInstance — только цифры',
} satisfies Record<LoginField, string>;

export function getLoginFieldErrorMessage(field: LoginField) {
  return LOGIN_FIELD_ERROR_MESSAGES[field];
}

export function getLoginReasonMessage(reason: LoginReason, messengerTitle: string) {
  return reason === 'sessionExpired'
    ? 'Сессия истекла. Войдите снова'
    : getGreenApiErrorMessage({ code: reason }, messengerTitle);
}

export const CHATS_STORAGE_ERROR_MESSAGE =
  'Не удалось сохранить список чатов в браузере — после перезагрузки он пропадёт';

export const UNEXPECTED_ERROR_MESSAGE = 'Не удалось показать экран. Повторите попытку';
