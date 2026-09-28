import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import type { MessengerId } from '@/entities/messenger/model';
import { useMessengerSession } from '@/features/messenger-session/messenger-session-provider';

import { logout } from './actions';

export function useLogout(messengerId: MessengerId) {
  const router = useRouter();
  const { store } = useMessengerSession(messengerId);
  const [isPending, startTransition] = useTransition();

  function logOut() {
    // An unauthorized result means the session is already gone, which is the goal anyway.
    startTransition(async () => {
      await logout(messengerId);
      store?.getState().clear();
      router.refresh();
    });
  }

  return { isPending, logOut };
}
