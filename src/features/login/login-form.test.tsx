import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Activity } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';

import type { LoginReason } from '@/shared/errors/model';

import { login } from './actions';
import { LoginScreen } from './login-screen';

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => ({ refresh }),
}));

vi.mock('./actions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./actions')>()),
  login: vi.fn(),
}));

const MISSING_LABEL_WARNING =
  'If you do not provide a visible label, you must specify an aria-label or aria-labelledby attribute for accessibility';

interface RenderOptions {
  isRealModeEnabled: boolean;
  reason: LoginReason | null;
}

function renderLoginScreen({ isRealModeEnabled, reason }: RenderOptions) {
  return render(
    <LoginScreen isRealModeEnabled={isRealModeEnabled} messengerId="max" reason={reason} />,
  );
}

function getSubmittedForm() {
  const formData = vi.mocked(login).mock.calls.at(-1)?.[2];
  if (formData === undefined) {
    throw new Error('login was not called');
  }
  return formData;
}

async function submitRealForm() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('idInstance'), '1101000001');
  await user.type(screen.getByLabelText('apiTokenInstance'), 'secret-token');
  await user.type(screen.getByLabelText('apiUrl'), 'https://1101.api.green-api.com');
  await user.click(screen.getByRole('checkbox'));
  await user.click(screen.getByRole('button', { name: 'Войти' }));
}

beforeEach(() => {
  vi.mocked(login).mockReset();
  refresh.mockClear();
});

test('offers only the demo sign-in when real mode is disabled', () => {
  renderLoginScreen({ isRealModeEnabled: false, reason: null });

  expect(screen.getByRole('button', { name: 'Войти в демо' })).toBeInTheDocument();
  expect(screen.queryByLabelText('idInstance')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Войти' })).not.toBeInTheDocument();
});

test('signs in to the demo and refreshes the page data', async () => {
  vi.mocked(login).mockResolvedValue({ data: null, ok: true });
  renderLoginScreen({ isRealModeEnabled: false, reason: null });

  await userEvent.click(screen.getByRole('button', { name: 'Войти в демо' }));

  expect(login).toHaveBeenCalledWith('max', null, expect.any(FormData));
  expect(getSubmittedForm().get('mode')).toBe('demo');
  await waitFor(() => {
    expect(refresh).toHaveBeenCalledOnce();
  });
});

test('submits the entered credentials in real mode', async () => {
  vi.mocked(login).mockResolvedValue({ data: null, ok: true });
  renderLoginScreen({ isRealModeEnabled: true, reason: null });

  await submitRealForm();

  const formData = getSubmittedForm();
  expect(formData.get('mode')).toBe('real');
  expect(formData.get('idInstance')).toBe('1101000001');
  expect(formData.get('apiTokenInstance')).toBe('secret-token');
  expect(formData.get('apiUrl')).toBe('https://1101.api.green-api.com');
  expect(formData.get('consent')).toBe('on');
  await waitFor(() => {
    expect(refresh).toHaveBeenCalledOnce();
  });
});

test('marks the fields the server rejected', async () => {
  vi.mocked(login).mockResolvedValue({
    error: { code: 'invalidInput', fields: ['apiUrl', 'consent'] },
    ok: false,
  });
  renderLoginScreen({ isRealModeEnabled: true, reason: null });

  await submitRealForm();

  await waitFor(() => {
    expect(screen.getByLabelText('apiUrl')).toHaveAttribute('aria-invalid', 'true');
  });
  expect(screen.getByLabelText('apiUrl')).toHaveAccessibleDescription(
    'Укажите адрес API из личного кабинета GREEN-API',
  );
  expect(screen.getByRole('checkbox')).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByRole('checkbox')).toHaveAccessibleDescription(
    'Подтвердите согласие на обработку персональных данных',
  );
  expect(screen.getByLabelText('idInstance')).not.toHaveAttribute('aria-invalid');
  expect(refresh).not.toHaveBeenCalled();
});

test('keeps the entered values after a rejected sign-in', async () => {
  vi.mocked(login).mockResolvedValue({ error: { code: 'unauthorized' }, ok: false });
  renderLoginScreen({ isRealModeEnabled: true, reason: null });

  await submitRealForm();

  await screen.findByRole('alert');
  expect(screen.getByLabelText('idInstance')).toHaveValue('1101000001');
});

test('explains a rejected token', async () => {
  vi.mocked(login).mockResolvedValue({ error: { code: 'unauthorized' }, ok: false });
  renderLoginScreen({ isRealModeEnabled: true, reason: null });

  await submitRealForm();

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Неверный idInstance или apiTokenInstance',
  );
});

test('blocks both sign-in buttons while signing in', async () => {
  vi.mocked(login).mockReturnValue(new Promise(() => undefined));
  renderLoginScreen({ isRealModeEnabled: true, reason: null });

  await submitRealForm();

  expect(screen.getByRole('button', { name: 'Войти' })).toHaveAttribute('aria-disabled', 'true');
  expect(screen.getByRole('button', { name: 'Войти в демо' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
});

test('hides the entered token', () => {
  renderLoginScreen({ isRealModeEnabled: true, reason: null });

  expect(screen.getByLabelText('apiTokenInstance')).toHaveAttribute('type', 'password');
  expect(screen.getByLabelText('apiTokenInstance')).toHaveAttribute('autocomplete', 'off');
});

test('shows why the previous session ended', () => {
  renderLoginScreen({ isRealModeEnabled: false, reason: 'sessionExpired' });

  expect(screen.getByRole('alert')).toHaveTextContent('Сессия истекла. Войдите снова');
});

test('keeps the field labels after being hidden and shown again', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const renderInActivity = (mode: 'hidden' | 'visible') => (
    <Activity mode={mode}>
      <LoginScreen isRealModeEnabled messengerId="max" reason={null} />
    </Activity>
  );

  try {
    const { rerender } = render(renderInActivity('visible'));
    rerender(renderInActivity('hidden'));
    rerender(renderInActivity('visible'));

    expect(screen.getByRole('textbox', { name: 'idInstance' })).toBeInTheDocument();
    expect(screen.getByLabelText('apiTokenInstance')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'apiUrl' })).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: 'Согласен на обработку персональных данных' }),
    ).toBeInTheDocument();
    expect(warn).not.toHaveBeenCalledWith(MISSING_LABEL_WARNING);
  } finally {
    warn.mockRestore();
  }
});
