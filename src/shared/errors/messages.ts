import type { GreenApiError, PhoneNumberErrorCode } from './model';

const GREEN_API_ERROR_MESSAGES = {
  accountNotFound: (messengerTitle) => `Номер не зарегистрирован в ${messengerTitle}`,
  instanceNotAuthorized: () =>
    'Инстанс не авторизован. Отсканируйте QR-код или авторизуйте его в личном кабинете GREEN-API',
  instanceTypeMismatch: (messengerTitle) => `Этот инстанс не относится к ${messengerTitle}`,
  invalidResponse: () => 'Сервис GREEN-API вернул неожиданный ответ. Повторите позже',
  network: () => 'Нет связи с GREEN-API. Проверьте подключение и повторите',
  notificationsDisabled: () =>
    'Включите получение входящих сообщений и статусов в настройках инстанса в личном кабинете',
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
