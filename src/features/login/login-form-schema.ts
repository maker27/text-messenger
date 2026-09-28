import 'server-only';

import { z } from 'zod';

import { getApiUrlSchema } from '@/server/green-api/api-url';
import {
  apiTokenInstanceSchema,
  idInstanceSchema,
  type GreenApiCredentials,
} from '@/server/green-api/credentials';
import type { LoginField } from '@/shared/errors/model';
import type { Result } from '@/shared/errors/result';

const CONSENT_CHECKED_VALUE = 'on';

const loginFieldSchema = z.enum([
  'apiTokenInstance',
  'apiUrl',
  'consent',
  'idInstance',
]) satisfies z.ZodType<LoginField>;

export interface LoginFormError {
  code: 'invalidInput';
  fields: LoginField[];
}

function createLoginFormSchema() {
  return z.object({
    apiTokenInstance: z.string().trim().pipe(apiTokenInstanceSchema),
    apiUrl: z.string().trim().pipe(getApiUrlSchema()),
    consent: z.literal(CONSENT_CHECKED_VALUE),
    idInstance: z.string().trim().pipe(idInstanceSchema),
  });
}

function collectInvalidFields(issues: z.core.$ZodIssue[]) {
  const fields = new Set(
    issues.flatMap(({ path }) => {
      const field = loginFieldSchema.safeParse(path[0]);
      return field.success ? [field.data] : [];
    }),
  );

  return [...fields].sort();
}

export function parseLoginForm(formData: FormData): Result<GreenApiCredentials, LoginFormError> {
  const form = createLoginFormSchema().safeParse(Object.fromEntries(formData));
  if (!form.success) {
    return {
      error: { code: 'invalidInput', fields: collectInvalidFields(form.error.issues) },
      ok: false,
    };
  }

  const { apiTokenInstance, apiUrl, idInstance } = form.data;
  return { data: { apiTokenInstance, apiUrl, idInstance }, ok: true };
}
