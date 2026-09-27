import { z } from 'zod';

export const messengerIdSchema = z.enum(['max', 'telegram', 'whatsapp']);

export type MessengerId = z.infer<typeof messengerIdSchema>;

export interface MessengerConfig {
  id: MessengerId;
  allowedCountryCodes: readonly string[] | null;
  chatIdStrategy: 'checkAccount' | 'checkWhatsapp';
  maxMessageLength: number;
  title: string;
  typeInstance: string;
}
