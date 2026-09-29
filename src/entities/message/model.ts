import { z } from 'zod';

const messageStatusSchema = z.enum(['delivered', 'failed', 'pending', 'read', 'sent']);

export const chatMessageSchema = z.object({
  chatId: z.string().min(1),
  direction: z.enum(['incoming', 'outgoing']),
  idMessage: z.string().min(1),
  senderName: z.string().nullable(),
  sentAt: z.number(),
  status: messageStatusSchema.nullable(),
  text: z.string(),
});

export type MessageStatus = z.infer<typeof messageStatusSchema>;

export type ChatMessage = z.infer<typeof chatMessageSchema>;
