import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { mocked, userEvent, within } from 'storybook/test';

import { login } from './actions';
import { LoginForm } from './login-form';

const RETRY_AFTER_SECONDS = 30;

const meta = {
  args: { isRealModeEnabled: true, messengerId: 'max' },
  component: LoginForm,
} satisfies Meta<typeof LoginForm>;

export default meta;

type Story = StoryObj<typeof meta>;

async function submitCredentials(canvasElement: HTMLElement) {
  await userEvent.click(within(canvasElement).getByRole('button', { name: 'Войти' }));
}

export const DemoOnly: Story = {
  args: { isRealModeEnabled: false },
};

export const RealMode: Story = {};

export const Pending: Story = {
  beforeEach: () => {
    mocked(login).mockReturnValue(new Promise(() => undefined));
  },
  play: async ({ canvasElement }) => {
    await submitCredentials(canvasElement);
  },
};

export const InvalidFields: Story = {
  beforeEach: () => {
    mocked(login).mockResolvedValue({
      error: { code: 'invalidInput', fields: ['apiTokenInstance', 'consent', 'idInstance'] },
      ok: false,
    });
  },
  play: async ({ canvasElement }) => {
    await submitCredentials(canvasElement);
  },
};

export const RateLimited: Story = {
  beforeEach: () => {
    mocked(login).mockResolvedValue({
      error: { code: 'rateLimited', retryAfter: RETRY_AFTER_SECONDS },
      ok: false,
    });
  },
  play: async ({ canvasElement }) => {
    await submitCredentials(canvasElement);
  },
};
