'use client';

import { SendHorizontal } from 'lucide-react';
import { useId, useRef, useState, type KeyboardEvent, type SyntheticEvent } from 'react';
import { Button, Form, Text, TextArea, TextField } from 'react-aria-components';

const COUNTER_THRESHOLD_RATIO = 0.9;

interface ComposerProps {
  isOffline: boolean;
  maxMessageLength: number;
  onMessageSubmit: (text: string) => void;
}

export function Composer({ isOffline, maxMessageLength, onMessageSubmit }: ComposerProps) {
  const fieldId = useId();
  const labelId = useId();
  const [text, setText] = useState('');
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const isTooLong = text.length > maxMessageLength;
  const canSubmit = text.trim() !== '' && !isTooLong && !isOffline;
  const isCounterVisible = text.length >= maxMessageLength * COUNTER_THRESHOLD_RATIO;

  function submitMessage() {
    if (!canSubmit) {
      return;
    }
    onMessageSubmit(text);
    setText('');
    fieldRef.current?.focus();
  }

  function handleFormSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    submitMessage();
  }

  // An Enter that confirms an IME composition must not send the unfinished text.
  function handleFieldKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submitMessage();
    }
  }

  return (
    <div className="composer-shell">
      <Form className="composer flex items-end gap-2" onSubmit={handleFormSubmit}>
        {/* A native label keeps its link to the field when React Activity hides and shows the form. */}
        <TextField
          aria-labelledby={labelId}
          className="flex min-w-0 flex-1 flex-col gap-1"
          id={fieldId}
          isInvalid={isTooLong}
          value={text}
          onChange={setText}
        >
          <label className="sr-only" htmlFor={fieldId} id={labelId}>
            Сообщение
          </label>
          <TextArea
            ref={fieldRef}
            className="field-sizing-content max-h-40 min-h-10 resize-none rounded-[var(--composer-radius)] border border-border bg-surface px-3 py-2 outline-none data-focus-visible:ring-2 data-focus-visible:ring-focus data-invalid:border-danger"
            placeholder="Сообщение"
            rows={1}
            onKeyDown={handleFieldKeyDown}
          />
          <Text
            className={`self-end text-xs empty:hidden ${isTooLong ? 'text-danger' : 'text-text-muted'}`}
            slot="description"
          >
            {isCounterVisible && `${String(text.length)} / ${String(maxMessageLength)}`}
          </Text>
        </TextField>
        <Button
          aria-label="Отправить"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent outline-none data-disabled:opacity-60 data-focus-visible:ring-2 data-focus-visible:ring-focus data-focus-visible:ring-offset-2"
          isDisabled={!canSubmit}
          type="submit"
        >
          <SendHorizontal aria-hidden className="size-5" />
        </Button>
      </Form>
    </div>
  );
}
