import { MESSENGERS } from '@/entities/messenger/config';
import type { MessengerId } from '@/entities/messenger/model';
import type { LoginReason } from '@/shared/errors/model';
import { getLoginReasonMessage } from '@/shared/errors/messages';

import { LoginForm } from './login-form';

interface LoginScreenProps {
  isRealModeEnabled: boolean;
  messengerId: MessengerId;
  reason: LoginReason | null;
}

export function LoginScreen({ isRealModeEnabled, messengerId, reason }: LoginScreenProps) {
  const { title } = MESSENGERS[messengerId];

  return (
    <section
      aria-labelledby={`${messengerId}-login-title`}
      className="mx-auto flex w-full max-w-sm flex-col gap-4 py-8"
    >
      <h3 className="text-xl font-semibold" id={`${messengerId}-login-title`}>
        Вход в {title}
      </h3>
      {reason !== null && <p role="alert">{getLoginReasonMessage(reason, title)}</p>}
      <LoginForm isRealModeEnabled={isRealModeEnabled} messengerId={messengerId} />
    </section>
  );
}
