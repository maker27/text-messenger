import {
  type PhoneNumber as ParsedPhoneNumber,
  parsePhoneNumberFromString,
} from 'libphonenumber-js';
import { z } from 'zod';

import type { PhoneNumberErrorCode } from '@/shared/errors/model';
import type { Result } from '@/shared/errors/result';

const DEFAULT_COUNTRY = 'RU';
const NON_DIGIT_PATTERN = /\D/g;
const FORMATTED_DIGITS_PATTERN = /^[\d\s().-]+$/;
const INTERNATIONAL_PREFIX = '+';

const phoneNumberSchema = z
  .string()
  .regex(/^[1-9]\d{6,14}$/)
  .brand<'PhoneNumber'>();

export type PhoneNumber = z.output<typeof phoneNumberSchema>;

function parseCandidate(value: string) {
  const number = parsePhoneNumberFromString(value, DEFAULT_COUNTRY);
  return number !== undefined && number.isValid() && number.ext === undefined ? number : null;
}

function findPhoneNumber(value: string): ParsedPhoneNumber | null {
  const trimmedValue = value.trim();
  const number = parseCandidate(trimmedValue);
  if (number !== null || !FORMATTED_DIGITS_PATTERN.test(trimmedValue)) {
    return number;
  }
  return parseCandidate(`${INTERNATIONAL_PREFIX}${trimmedValue.replace(NON_DIGIT_PATTERN, '')}`);
}

export function parsePhoneNumber(
  value: string,
  allowedCountryCodes: readonly string[] | null,
): Result<PhoneNumber, PhoneNumberErrorCode> {
  const number = findPhoneNumber(value);
  const phoneNumber = phoneNumberSchema.safeParse(
    number?.number.slice(INTERNATIONAL_PREFIX.length),
  );
  if (number === null || !phoneNumber.success) {
    return { ok: false, error: 'invalid' };
  }
  if (allowedCountryCodes !== null && !allowedCountryCodes.includes(number.countryCallingCode)) {
    return { ok: false, error: 'countryNotAllowed' };
  }
  return { ok: true, data: phoneNumber.data };
}
