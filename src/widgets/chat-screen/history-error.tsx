'use client';

import { LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useEffectEvent, useRef, useTransition } from 'react';
import { Button } from 'react-aria-components';

import { MESSENGERS } from '@/entities/messenger/config';
import type { MessengerId } from '@/entities/messenger/model';
import { useMessengerStore } from '@/features/messenger-session/messenger-session-provider';
import { getGreenApiErrorMessage } from '@/shared/errors/messages';
import type { GreenApiError } from '@/shared/errors/model';

interface HistoryErrorProps {
  error: GreenApiError;
  messengerId: MessengerId;
}

export function HistoryError({ error, messengerId }: HistoryErrorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isConnectionOnline = useMessengerStore((state) => state.connection.status === 'online');
  const wasConnectionOnlineRef = useRef(isConnectionOnline);

  function refreshHistory() {
    startTransition(() => {
      router.refresh();
    });
  }

  const handleConnectionRestore = useEffectEvent(refreshHistory);

  useEffect(() => {
    if (isConnectionOnline && !wasConnectionOnlineRef.current) {
      handleConnectionRestore();
    }
    wasConnectionOnlineRef.current = isConnectionOnline;
  }, [isConnectionOnline]);

  function handleRetryPress() {
    refreshHistory();
  }

  return (
    <div className="flex flex-1 flex-col items-start gap-4 p-3" role="alert">
      <p>{getGreenApiErrorMessage(error, MESSENGERS[messengerId].title)}</p>
      <Button
        className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border px-4 text-sm font-medium text-accent-text outline-none data-focus-visible:ring-2 data-focus-visible:ring-focus data-hovered:bg-surface-muted data-pending:opacity-60"
        isPending={isPending}
        onPress={handleRetryPress}
      >
        {isPending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
        Повторить
      </Button>
    </div>
  );
}
