'use client';

import { useEffect, useEffectEvent, useRef } from 'react';
import { Button } from 'react-aria-components';

import { MESSENGERS } from '@/entities/messenger/config';
import type { MessengerId } from '@/entities/messenger/model';
import { useMessengerStore } from '@/features/messenger-session/messenger-session-provider';
import { getGreenApiErrorMessage } from '@/shared/errors/messages';
import type { GreenApiError } from '@/shared/errors/model';

interface HistoryErrorProps {
  className: string;
  error: GreenApiError;
  messengerId: MessengerId;
  onRetry: () => void;
}

export function HistoryError({ className, error, messengerId, onRetry }: HistoryErrorProps) {
  const isConnectionOnline = useMessengerStore((state) => state.connection.status === 'online');
  const wasConnectionOnlineRef = useRef(isConnectionOnline);
  const handleConnectionRestore = useEffectEvent(onRetry);

  useEffect(() => {
    if (isConnectionOnline && !wasConnectionOnlineRef.current) {
      handleConnectionRestore();
    }
    wasConnectionOnlineRef.current = isConnectionOnline;
  }, [isConnectionOnline]);

  return (
    <div className={`flex flex-col items-start gap-4 p-3 ${className}`} role="alert">
      <p>{getGreenApiErrorMessage(error, MESSENGERS[messengerId].title)}</p>
      <Button
        className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border px-4 text-sm font-medium text-accent-text outline-none data-focus-visible:ring-2 data-focus-visible:ring-focus data-hovered:bg-surface-muted"
        onPress={onRetry}
      >
        Повторить
      </Button>
    </div>
  );
}
