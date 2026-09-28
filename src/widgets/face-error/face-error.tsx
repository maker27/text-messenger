'use client';

import { MESSENGERS } from '@/entities/messenger/config';
import type { MessengerId } from '@/entities/messenger/model';
import { UNEXPECTED_ERROR_MESSAGE } from '@/shared/errors/messages';

interface FaceErrorProps {
  messenger: MessengerId;
  onRetry: () => void;
}

export function FaceError({ messenger, onRetry }: FaceErrorProps) {
  return (
    <div className="flex h-full flex-col items-start gap-4 p-4" role="alert">
      <h2 className="text-lg font-semibold outline-none" tabIndex={-1}>
        {MESSENGERS[messenger].title}
      </h2>
      <p>{UNEXPECTED_ERROR_MESSAGE}</p>
      <button
        className="rounded-md border border-border px-4 py-2 font-medium text-accent outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-focus"
        type="button"
        onClick={onRetry}
      >
        Повторить
      </button>
    </div>
  );
}
