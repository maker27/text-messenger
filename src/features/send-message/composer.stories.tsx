import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn, userEvent, within } from 'storybook/test';

import { Composer } from './composer';

const MAX_MESSAGE_LENGTH = 40;
const TOO_LONG_TEXT = 'Сообщение длиннее допустимого лимита символов';

const meta = {
  args: {
    isOffline: false,
    maxMessageLength: MAX_MESSAGE_LENGTH,
    onMessageSubmit: fn(),
  },
  component: Composer,
} satisfies Meta<typeof Composer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Offline: Story = {
  args: { isOffline: true },
};

export const TooLong: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.type(within(canvasElement).getByRole('textbox'), TOO_LONG_TEXT);
  },
};
