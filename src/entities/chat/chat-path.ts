import type { MessengerId } from '@/entities/messenger/model';

export function getChatPath(messengerId: MessengerId, chatId: string) {
  return `/${messengerId}/${encodeURIComponent(chatId)}`;
}
