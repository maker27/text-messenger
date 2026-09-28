'use client';

import { LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Button } from 'react-aria-components';

import { MESSENGERS } from '@/entities/messenger/config';
import type { MessengerId } from '@/entities/messenger/model';
import { getGreenApiErrorMessage } from '@/shared/errors/messages';
import type { GreenApiError } from '@/shared/errors/model';

interface HistoryErrorProps {
  error: GreenApiError;
  messengerId: MessengerId;
}

export function HistoryError({ error, messengerId }: HistoryErrorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleRetryPress() {
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="flex flex-1 flex-col items-start gap-4 p-3" role="alert">
      <p>{getGreenApiErrorMessage(error, MESSENGERS[messengerId].title)}</p>
      <Button
        className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border px-4 text-sm font-medium text-accent-button outline-none data-focus-visible:ring-2 data-focus-visible:ring-focus data-hovered:bg-surface-muted data-pending:opacity-60"
        isPending={isPending}
        onPress={handleRetryPress}
      >
        {isPending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
        Повторить
      </Button>
    </div>
  );
}
