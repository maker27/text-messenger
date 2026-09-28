import { messengerIdSchema } from './model';

export function getActiveMessenger(pathname: string) {
  const parsed = messengerIdSchema.safeParse(pathname.split('/')[1]);
  return parsed.success ? parsed.data : null;
}
