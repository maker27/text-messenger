import { User } from 'lucide-react';

import { getAvatarColor } from './avatar-color';

interface ChatAvatarProps {
  chatId: string;
  isHeader?: boolean;
  title: string;
}

export function ChatAvatar({ chatId, isHeader = false, title }: ChatAvatarProps) {
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full text-on-accent ${isHeader ? 'size-[var(--avatar-size-header)]' : 'size-[var(--avatar-size)]'}`}
      style={{ backgroundColor: getAvatarColor(chatId) }}
      title={title}
    >
      <User className="size-1/2" />
    </span>
  );
}
