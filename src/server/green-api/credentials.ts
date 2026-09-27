import 'server-only';

import { z } from 'zod';

import type { ApiUrl } from './api-url';

const ID_INSTANCE_PATTERN = /^\d{1,20}$/;
// Both values become request path segments, so any character beyond ASCII alphanumerics
// could rewrite the path (dot segments, percent-encoding, query or fragment).
const API_TOKEN_INSTANCE_PATTERN = /^[A-Za-z0-9]{1,256}$/;

export const idInstanceSchema = z.string().regex(ID_INSTANCE_PATTERN).brand<'IdInstance'>();

export const apiTokenInstanceSchema = z
  .string()
  .regex(API_TOKEN_INSTANCE_PATTERN)
  .brand<'ApiTokenInstance'>();

export interface GreenApiCredentials {
  apiTokenInstance: z.output<typeof apiTokenInstanceSchema>;
  apiUrl: ApiUrl;
  idInstance: z.output<typeof idInstanceSchema>;
}
