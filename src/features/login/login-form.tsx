'use client';

import { LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  startTransition,
  useActionState,
  useId,
  useState,
  type ReactNode,
  type SyntheticEvent,
} from 'react';
import {
  Button,
  CheckboxButton,
  CheckboxField,
  FieldError,
  Form,
  Input,
  TextField,
  type TextFieldProps,
} from 'react-aria-components';

import { MESSENGERS } from '@/entities/messenger/config';
import type { MessengerId } from '@/entities/messenger/model';
import type { SessionMode } from '@/server/session/session';
import { getGreenApiErrorMessage, getLoginFieldErrorMessage } from '@/shared/errors/messages';
import type { Result } from '@/shared/errors/result';

import { login, type LoginError } from './actions';

const API_URL_PLACEHOLDER = 'https://api.greenapi.com';

const BUTTON_CLASS_NAME =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium outline-none data-focus-visible:ring-2 data-focus-visible:ring-focus data-focus-visible:ring-offset-2 data-pending:opacity-60';

const PRIMARY_BUTTON_CLASS_NAME = `${BUTTON_CLASS_NAME} bg-accent text-on-accent`;

const SECONDARY_BUTTON_CLASS_NAME = `${BUTTON_CLASS_NAME} border border-border data-hovered:bg-surface-muted`;

const INPUT_CLASS_NAME =
  'min-h-10 rounded-md border border-border bg-surface px-3 outline-none data-focus-visible:ring-2 data-focus-visible:ring-focus data-invalid:border-danger';

const FIELD_ERROR_CLASS_NAME = 'text-sm text-danger';

type LoginState = Result<null, LoginError> | null;

interface LoginTextFieldProps {
  children: ReactNode;
  label: string;
  name: string;
  type?: TextFieldProps['type'];
}

// A native label keeps its link to the field when React Activity hides and shows the form.
function LoginTextField({ children, label, name, type }: LoginTextFieldProps) {
  const fieldId = useId();
  const labelId = useId();

  return (
    <TextField
      aria-labelledby={labelId}
      className="flex flex-col gap-1"
      id={fieldId}
      name={name}
      type={type}
    >
      <label className="text-sm font-medium" htmlFor={fieldId} id={labelId}>
        {label}
      </label>
      {children}
      <FieldError className={FIELD_ERROR_CLASS_NAME} />
    </TextField>
  );
}

interface LoginFormProps {
  isRealModeEnabled: boolean;
  messengerId: MessengerId;
}

export function LoginForm({ isRealModeEnabled, messengerId }: LoginFormProps) {
  const router = useRouter();
  const [submittedMode, setSubmittedMode] = useState<SessionMode | null>(null);
  const [state, formAction, isPending] = useActionState(submitLogin, null);
  const error = state === null || state.ok ? null : state.error;
  const invalidFields = error?.code === 'invalidInput' ? error.fields : [];
  const validationErrors = Object.fromEntries(
    invalidFields.map((field) => [field, getLoginFieldErrorMessage(field)]),
  );

  async function submitLogin(_previousState: LoginState, formData: FormData) {
    const result = await login(messengerId, null, formData);

    if (result.ok) {
      router.refresh();
    }
    return result;
  }

  // Submitting through onSubmit keeps React from resetting the entered values after a failure.
  function handleFormSubmit(event: SyntheticEvent<HTMLFormElement>, mode: SessionMode) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set('mode', mode);
    setSubmittedMode(mode);
    startTransition(() => {
      formAction(formData);
    });
  }

  function renderSubmitContent(mode: SessionMode, label: string) {
    return (
      <>
        {isPending && submittedMode === mode && (
          <LoaderCircle aria-hidden className="size-4 animate-spin" />
        )}
        {label}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {error !== null && error.code !== 'invalidInput' && (
        <p className="text-danger" role="alert">
          {getGreenApiErrorMessage(error, MESSENGERS[messengerId].title)}
        </p>
      )}
      <form
        onSubmit={(event) => {
          handleFormSubmit(event, 'demo');
        }}
      >
        <Button
          className={isRealModeEnabled ? SECONDARY_BUTTON_CLASS_NAME : PRIMARY_BUTTON_CLASS_NAME}
          isPending={isPending}
          type="submit"
        >
          {renderSubmitContent('demo', 'Войти в демо')}
        </Button>
      </form>
      {isRealModeEnabled && (
        <Form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            handleFormSubmit(event, 'real');
          }}
          validationBehavior="aria"
          validationErrors={validationErrors}
        >
          <LoginTextField label="idInstance" name="idInstance">
            <Input autoComplete="off" className={INPUT_CLASS_NAME} inputMode="numeric" />
          </LoginTextField>
          <LoginTextField label="apiTokenInstance" name="apiTokenInstance" type="password">
            <Input autoComplete="off" className={INPUT_CLASS_NAME} />
          </LoginTextField>
          <LoginTextField label="apiUrl" name="apiUrl" type="url">
            <Input className={INPUT_CLASS_NAME} placeholder={API_URL_PLACEHOLDER} />
          </LoginTextField>
          <CheckboxField className="flex flex-col gap-1" name="consent">
            <CheckboxButton className="group flex items-start gap-2 text-sm">
              <span
                aria-hidden
                className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border border-border group-data-focus-visible:ring-2 group-data-focus-visible:ring-focus group-data-invalid:border-danger group-data-selected:border-accent group-data-selected:bg-accent"
              >
                <span className="hidden size-2 rounded-sm bg-on-accent group-data-selected:block" />
              </span>
              Согласен на обработку персональных данных
            </CheckboxButton>
            <FieldError className={FIELD_ERROR_CLASS_NAME} />
          </CheckboxField>
          <Button className={PRIMARY_BUTTON_CLASS_NAME} isPending={isPending} type="submit">
            {renderSubmitContent('real', 'Войти')}
          </Button>
        </Form>
      )}
    </div>
  );
}
