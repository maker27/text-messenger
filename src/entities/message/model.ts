export type MessageStatus = 'delivered' | 'failed' | 'pending' | 'read' | 'sent';

export interface ChatMessage {
  chatId: string;
  direction: 'incoming' | 'outgoing';
  idMessage: string;
  senderName: string | null;
  sentAt: number;
  status: MessageStatus | null;
  text: string;
}
