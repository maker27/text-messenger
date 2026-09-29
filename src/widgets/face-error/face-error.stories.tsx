import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';

import { FaceError } from './face-error';

const meta = {
  args: { messenger: 'max', onRetry: fn() },
  component: FaceError,
} satisfies Meta<typeof FaceError>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
