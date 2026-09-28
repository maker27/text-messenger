'use client';

import { LoaderCircle, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  startTransition,
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  type SyntheticEvent,
} from 'react';
import { Button, FieldError, Form, Input, TextField } from 'react-aria-components';

import { getChatPath } from '@/entities/chat/chat-path';
import { formatPhoneNumberInput } from '@/entities/chat/phone-number';
import { MESSENGERS } from '@/entities/messenger/config';
import type { MessengerId } from '@/entities/messenger/model';
import { useMessengerStore } from '@/features/messenger-session/messenger-session-provider';
import { getGreenApiErrorMessage, getPhoneNumberErrorMessage } from '@/shared/errors/messages';
import type { Result } from '@/shared/errors/result';

import { createChat, type CreateChatError } from './actions';

const PHONE_PLACEHOLDER = '+7 916 123 45 67';

type CreateChatState = Result<null, CreateChatError> | null;

interface ErrorDescription {
  isPhoneError: boolean;
  message: string;
}

function describeError(error: CreateChatError, messengerTitle: string): ErrorDescription {
  switch (error.code) {
    case 'invalidInput':
      return { isPhoneError: true, message: getPhoneNumberErrorMessage('invalid', messengerTitle) };
    case 'phoneNumber':
      return {
        isPhoneError: true,
        message: getPhoneNumberErrorMessage(error.reason, messengerTitle),
      };
    default:
      return {
        isPhoneError: error.code === 'accountNotFound',
        message: getGreenApiErrorMessage(error, messengerTitle),
      };
  }
}

interface CreateChatFormProps {
  messengerId: MessengerId;
}

export function CreateChatForm({ messengerId }: CreateChatFormProps) {
  const router = useRouter();
  const addChat = useMessengerStore((state) => state.addChat);
  const phoneInputId = useId();
  const phoneLabelId = useId();
  const [phone, setPhone] = useState('');
  const [state, formAction, isPending] = useActionState(submitCreateChat, null);
  const { title } = MESSENGERS[messengerId];
  const error = state === null || state.ok ? null : describeError(state.error, title);
  const isPhoneError = error?.isPhoneError === true;
  const phoneInputRef = useRef<HTMLInputElement>(null);

  // Moving focus to the field makes screen readers announce its error, which has no live region.
  useEffect(() => {
    if (isPhoneError) {
      phoneInputRef.current?.focus();
    }
  }, [isPhoneError, state]);

  async function submitCreateChat(
    _previousState: CreateChatState,
    formData: FormData,
  ): Promise<CreateChatState> {
    const result = await createChat(messengerId, null, formData);
    if (!result.ok) {
      return result;
    }
    addChat(result.data);
    setPhone('');
    router.push(getChatPath(messengerId, result.data.chatId));
    return { data: null, ok: true };
  }

  // Reformatting an edit inside the value would move the caret to its end.
  function handlePhoneChange(value: string) {
    const formattedValue = formatPhoneNumberInput(value);
    if (formattedValue === null) {
      return;
    }
    const isCaretAtEnd = phoneInputRef.current?.selectionStart === value.length;
    setPhone(isCaretAtEnd ? formattedValue : value);
  }

  // Submitting through onSubmit keeps React from resetting the entered value after a failure.
  function handleFormSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => {
      formAction(formData);
    });
  }

  return (
    <Form
      className="flex flex-col gap-2"
      validationBehavior="aria"
      validationErrors={isPhoneError ? { phone: error.message } : {}}
      onSubmit={handleFormSubmit}
    >
      {/* A native label keeps its link to the field when React Activity hides and shows the form. */}
      <TextField
        aria-labelledby={phoneLabelId}
        className="flex flex-col gap-1"
        id={phoneInputId}
        name="phone"
        type="tel"
        value={phone}
        onChange={handlePhoneChange}
      >
        <label className="text-sm font-medium" htmlFor={phoneInputId} id={phoneLabelId}>
          Номер телефона
        </label>
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted"
          />
          <Input
            ref={phoneInputRef}
            autoComplete="off"
            className="min-h-10 w-full rounded-full border-none bg-surface-muted py-2 pr-3 pl-9 outline-none data-focus-visible:ring-2 data-focus-visible:ring-focus data-invalid:ring-2 data-invalid:ring-danger"
            placeholder={PHONE_PLACEHOLDER}
          />
        </div>
        <FieldError className="text-sm text-danger" />
      </TextField>
      {error !== null && !isPhoneError && (
        <p className="text-sm text-danger" role="alert">
          {error.message}
        </p>
      )}
      <Button
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-accent-button px-4 text-sm font-medium text-on-accent outline-none data-focus-visible:ring-2 data-focus-visible:ring-focus data-focus-visible:ring-offset-2 data-pending:opacity-60"
        isPending={isPending}
        type="submit"
      >
        {isPending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
        Создать чат
      </Button>
    </Form>
  );
}
