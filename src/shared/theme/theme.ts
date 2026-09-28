import { z } from 'zod';

export const themeSchema = z.enum(['dark', 'light']);

export type Theme = z.infer<typeof themeSchema>;

export const THEME_COOKIE_NAME = 'tm_theme';

export function parseTheme(value: string | undefined): Theme | null {
  const theme = themeSchema.safeParse(value);
  return theme.success ? theme.data : null;
}
