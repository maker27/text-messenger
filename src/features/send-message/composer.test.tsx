import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Activity } from 'react';
import { expect, test, vi } from 'vitest';

import { Composer } from './composer';

const MAX_MESSAGE_LENGTH = 10;

const MISSING_LABEL_WARNING =
  'If you do not provide a visible label, you must specify an aria-label or aria-labelledby attribute for accessibility';

function renderComposer() {
  const onMessageSubmit = vi.fn();
  render(<Composer maxMessageLength={MAX_MESSAGE_LENGTH} onMessageSubmit={onMessageSubmit} />);
  return { field: screen.getByLabelText('Сообщение'), onMessageSubmit, user: userEvent.setup() };
}

test('sends the message on Enter and keeps the focus in the cleared field', async () => {
  const { field, onMessageSubmit, user } = renderComposer();

  await user.type(field, ' Привет {Enter}');

  expect(onMessageSubmit).toHaveBeenCalledExactlyOnceWith(' Привет ');
  expect(field).toHaveValue('');
  expect(field).toHaveFocus();
});

test('keeps the text when Enter confirms an IME composition', async () => {
  const { field, onMessageSubmit, user } = renderComposer();
  await user.type(field, 'にほん');

  fireEvent.keyDown(field, { isComposing: true, key: 'Enter' });

  expect(onMessageSubmit).not.toHaveBeenCalled();
  expect(field).toHaveValue('にほん');
});

test('adds a line break on Shift+Enter', async () => {
  const { field, onMessageSubmit, user } = renderComposer();

  await user.type(field, 'а{Shift>}{Enter}{/Shift}б');

  expect(field).toHaveValue('а\nб');
  expect(onMessageSubmit).not.toHaveBeenCalled();
});

test('sends the message with the send button and returns the focus to the field', async () => {
  const { field, onMessageSubmit, user } = renderComposer();

  await user.type(field, 'Привет');
  await user.click(screen.getByRole('button', { name: 'Отправить' }));

  expect(onMessageSubmit).toHaveBeenCalledExactlyOnceWith('Привет');
  expect(field).toHaveValue('');
  expect(field).toHaveFocus();
});

test('does not send a blank message', async () => {
  const { field, onMessageSubmit, user } = renderComposer();

  await user.type(field, '   {Enter}');

  expect(onMessageSubmit).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Отправить' })).toBeDisabled();
});

test('shows the length counter from 90% of the limit', async () => {
  const { field, user } = renderComposer();

  await user.type(field, 'а'.repeat(8));
  expect(screen.queryByText('8 / 10')).not.toBeInTheDocument();

  await user.type(field, 'а');
  expect(field).toHaveAccessibleDescription('9 / 10');
});

test('blocks a message over the limit', async () => {
  const { field, onMessageSubmit, user } = renderComposer();

  await user.type(field, `${'а'.repeat(MAX_MESSAGE_LENGTH + 1)}{Enter}`);

  expect(onMessageSubmit).not.toHaveBeenCalled();
  expect(field).toHaveAttribute('aria-invalid', 'true');
  expect(field).toHaveAccessibleDescription('11 / 10');
  expect(screen.getByRole('button', { name: 'Отправить' })).toBeDisabled();
});

test('keeps the field label after being hidden and shown again', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const renderInActivity = (mode: 'hidden' | 'visible') => (
    <Activity mode={mode}>
      <Composer maxMessageLength={MAX_MESSAGE_LENGTH} onMessageSubmit={vi.fn()} />
    </Activity>
  );

  try {
    const { rerender } = render(renderInActivity('visible'));
    rerender(renderInActivity('hidden'));
    rerender(renderInActivity('visible'));

    expect(screen.getByRole('textbox', { name: 'Сообщение' })).toBeInTheDocument();
    expect(warn).not.toHaveBeenCalledWith(MISSING_LABEL_WARNING);
  } finally {
    warn.mockRestore();
  }
});
