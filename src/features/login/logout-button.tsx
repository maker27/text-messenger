'use client';

import { LoaderCircle, LogOut } from 'lucide-react';

import type { MessengerId } from '@/entities/messenger/model';

import { useLogout } from './use-logout';

interface LogoutButtonProps {
  messengerId: MessengerId;
}

export function LogoutButton({ messengerId }: LogoutButtonProps) {
  const { isPending, logOut } = useLogout(messengerId);

  return (
    <button
      aria-label={isPending ? 'Выход…' : 'Выйти'}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-60"
      disabled={isPending}
      onClick={logOut}
      type="button"
    >
      {isPending ? (
        <LoaderCircle aria-hidden className="size-4 animate-spin" />
      ) : (
        <LogOut aria-hidden className="size-4" />
      )}
    </button>
  );
}
