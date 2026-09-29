import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { mocked, userEvent, within } from 'storybook/test';

import { withMessengerStore } from '@/features/messenger-session/with-messenger-store';

import { createChat } from './actions';
import { CreateChatForm } from './create-chat-form';

const PHONE_NUMBER = '+7 916 123 45 67';

const meta = {
  args: { messengerId: 'max' },
  component: CreateChatForm,
  decorators: [withMessengerStore(() => undefined)],
} satisfies Meta<typeof CreateChatForm>;

export default meta;

type Story = StoryObj<typeof meta>;

async function submitPhoneNumber(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await userEvent.type(canvas.getByLabelText('Номер телефона'), PHONE_NUMBER);
  await userEvent.click(canvas.getByRole('button', { name: 'Создать чат' }));
}

export const Empty: Story = {};

export const Pending: Story = {
  beforeEach: () => {
    mocked(createChat).mockReturnValue(new Promise(() => undefined));
  },
  play: async ({ canvasElement }) => {
    await submitPhoneNumber(canvasElement);
  },
};

export const PhoneError: Story = {
  beforeEach: () => {
    mocked(createChat).mockResolvedValue({
      error: { code: 'phoneNumber', reason: 'invalid' },
      ok: false,
    });
  },
  play: async ({ canvasElement }) => {
    await submitPhoneNumber(canvasElement);
  },
};

export const ServiceError: Story = {
  beforeEach: () => {
    mocked(createChat).mockResolvedValue({ error: { code: 'network' }, ok: false });
  },
  play: async ({ canvasElement }) => {
    await submitPhoneNumber(canvasElement);
  },
};
