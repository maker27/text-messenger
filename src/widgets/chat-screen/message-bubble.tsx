import { Check, CheckCheck, CircleAlert, Clock, type LucideIcon } from 'lucide-react';
import { Button } from 'react-aria-components';

import type { MessageGroupPosition } from '@/entities/message/message-group';
import type { ChatMessage, MessageStatus } from '@/entities/message/model';

import './chat-screen.css';

const TIME_FORMAT = new Intl.DateTimeFormat('ru', { hour: '2-digit', minute: '2-digit' });

interface StatusView {
  Icon: LucideIcon;
  label: string;
}

const STATUS_VIEWS: Record<MessageStatus, StatusView> = {
  delivered: { Icon: CheckCheck, label: 'Доставлено' },
  failed: { Icon: CircleAlert, label: 'Не отправлено' },
  pending: { Icon: Clock, label: 'Отправляется' },
  read: { Icon: CheckCheck, label: 'Прочитано' },
  sent: { Icon: Check, label: 'Отправлено' },
};

interface MessageBubbleProps {
  groupPosition: MessageGroupPosition;
  message: ChatMessage;
  onMessageRetry: (localId: string) => void;
}

export function MessageBubble({ groupPosition, message, onMessageRetry }: MessageBubbleProps) {
  const isOutgoing = message.direction === 'outgoing';
  const statusView = message.status === null ? null : STATUS_VIEWS[message.status];
  const timeClassName = isOutgoing ? 'text-bubble-time-out' : 'text-text-muted';
  const statusClassName = message.status === 'read' ? 'text-tick-read' : timeClassName;

  function handleRetryPress() {
    onMessageRetry(message.idMessage);
  }

  return (
    <li className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`message-bubble flex max-w-[var(--bubble-max-width)] min-w-0 flex-col gap-1 px-3 py-2 ${isOutgoing ? 'bg-bubble-out text-bubble-out-text' : 'bg-bubble-in text-text'}`}
        data-direction={message.direction}
        data-group-position={groupPosition}
      >
        <p className="break-words whitespace-pre-wrap">{message.text}</p>
        <p className={`flex items-center justify-end gap-1 text-xs ${timeClassName}`}>
          <time dateTime={new Date(message.sentAt).toISOString()}>
            {TIME_FORMAT.format(message.sentAt)}
          </time>
          {statusView !== null && (
            <statusView.Icon
              aria-label={statusView.label}
              className={`size-4 ${statusClassName}`}
              role="img"
            />
          )}
          {message.status === 'failed' && (
            <Button
              className="rounded-sm font-medium text-danger underline outline-none data-focus-visible:ring-2 data-focus-visible:ring-focus"
              onPress={handleRetryPress}
            >
              Повторить
            </Button>
          )}
        </p>
      </div>
    </li>
  );
}
