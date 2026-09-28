import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';

import { createMessengerStore } from '@/entities/message/messenger-store';
import { MessengerStoreContext } from '@/features/messenger-session/messenger-session-provider';
import { MemoryStorage } from '@/shared/testing/memory-storage';

import { createChat } from './actions';
import { CreateChatForm } from './create-chat-form';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => ({ push }),
}));

vi.mock('./actions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./actions')>()),
  createChat: vi.fn(),
}));

const WHATSAPP_CHAT = {
  chatId: '79161234567@c.us',
  lastMessageAt: null,
  title: '+7 916 123 45 67',
};

const MISSING_LABEL_WARNING =
  'If you do not provide a visible label, you must specify an aria-label or aria-labelledby attribute for accessibility';

function renderForm() {
  const store = createMessengerStore({
    idInstance: '1101000000000001',
    messengerId: 'whatsapp',
    storage: new MemoryStorage(),
  });

  render(
    <MessengerStoreContext value={store}>
      <CreateChatForm messengerId="whatsapp" />
    </MessengerStoreContext>,
  );

  return store;
}

async function submitPhone(phone: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Номер телефона'), phone);
  await user.click(screen.getByRole('button', { name: 'Создать чат' }));
}

beforeEach(() => {
  vi.mocked(createChat).mockReset();
  push.mockClear();
});

test('opens the created chat', async () => {
  vi.mocked(createChat).mockResolvedValue({ data: WHATSAPP_CHAT, ok: true });
  const store = renderForm();

  await submitPhone('+7 916 123-45-67');

  await waitFor(() => {
    expect(push).toHaveBeenCalledWith('/whatsapp/79161234567%40c.us');
  });
  const formData = vi.mocked(createChat).mock.calls.at(-1)?.[2];
  expect(formData instanceof FormData && formData.get('phone')).toBe('+7 916 123 45 67');
  expect(store.getState().chats).toEqual([WHATSAPP_CHAT]);
  expect(screen.getByLabelText('Номер телефона')).toHaveValue('');
});

test('asks for the phone field type', () => {
  renderForm();

  expect(screen.getByLabelText('Номер телефона')).toHaveAttribute('type', 'tel');
});

test('renders the phone field without label warnings', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

  try {
    renderForm();
    const label = screen.getByText('Номер телефона');
    const phoneField = screen.getByLabelText('Номер телефона');

    expect(phoneField).toHaveAttribute('aria-labelledby', label.id);
    expect(warn).not.toHaveBeenCalledWith(MISSING_LABEL_WARNING);
  } finally {
    warn.mockRestore();
  }
});

test('formats the number while typing', async () => {
  renderForm();

  await userEvent.setup().type(screen.getByLabelText('Номер телефона'), '79161234567');

  expect(screen.getByLabelText('Номер телефона')).toHaveValue('+7 916 123 45 67');
});

test('ignores digits beyond an international number', async () => {
  renderForm();

  await userEvent.setup().type(screen.getByLabelText('Номер телефона'), '79999999999999999');

  expect(screen.getByLabelText('Номер телефона')).toHaveValue('+7 99999999999999');
});

test('keeps the caret when editing inside the number', async () => {
  const user = userEvent.setup();
  renderForm();
  const phoneField = screen.getByLabelText('Номер телефона');

  await user.type(phoneField, '79161234567');
  await user.type(phoneField, '{ArrowLeft}{ArrowLeft}{ArrowLeft}{Backspace}');

  expect(phoneField).toHaveValue('+7 916 123 4 67');
  expect(phoneField).toHaveProperty('selectionStart', 12);
});

test('links a rejected number to the phone field', async () => {
  vi.mocked(createChat).mockResolvedValue({
    error: { code: 'phoneNumber', reason: 'invalid' },
    ok: false,
  });
  renderForm();

  await submitPhone('+7 916');

  const phoneField = screen.getByLabelText('Номер телефона');
  await waitFor(() => {
    expect(phoneField).toHaveAttribute('aria-invalid', 'true');
  });
  expect(phoneField).toHaveAccessibleDescription(
    'Введите номер телефона в международном формате, например +7 916 123-45-67',
  );
  expect(phoneField).toHaveValue('+7 916');
  expect(phoneField).toHaveFocus();
  expect(push).not.toHaveBeenCalled();
});

test('links a number without an account to the phone field', async () => {
  vi.mocked(createChat).mockResolvedValue({ error: { code: 'accountNotFound' }, ok: false });
  renderForm();

  await submitPhone('+7 916 000-00-00');

  await waitFor(() => {
    expect(screen.getByLabelText('Номер телефона')).toHaveAccessibleDescription(
      'Номер не зарегистрирован в WhatsApp',
    );
  });
});

test('announces a failed request', async () => {
  vi.mocked(createChat).mockResolvedValue({ error: { code: 'network' }, ok: false });
  renderForm();

  await submitPhone('+7 916 123-45-67');

  await waitFor(() => {
    expect(screen.getByRole('alert')).not.toBeEmptyDOMElement();
  });
  expect(screen.getByLabelText('Номер телефона')).not.toHaveAttribute('aria-invalid');
});

test('blocks the button while the chat is being created', async () => {
  vi.mocked(createChat).mockReturnValue(new Promise(() => undefined));
  renderForm();

  await submitPhone('+7 916 123-45-67');

  expect(screen.getByRole('button', { name: 'Создать чат' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
});
