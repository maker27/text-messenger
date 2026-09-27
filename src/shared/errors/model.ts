type GreenApiFailureCode =
  | 'accountNotFound'
  | 'instanceTypeMismatch'
  | 'invalidResponse'
  | 'network'
  | 'notificationsDisabled'
  | 'realModeDisabled'
  | 'timeout'
  | 'unauthorized'
  | 'upstream'
  | 'webhookConfigured';

export type GreenApiError =
  { code: 'rateLimited'; retryAfter: number | null } | { code: GreenApiFailureCode };

export type PhoneNumberErrorCode = 'countryNotAllowed' | 'invalid';
