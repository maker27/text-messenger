import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { spyOn } from 'storybook/test';

import { OfflineBanner } from './offline-banner';

const meta = {
  component: OfflineBanner,
} satisfies Meta<typeof OfflineBanner>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Online: Story = {};

export const Offline: Story = {
  beforeEach: () => {
    spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  },
};
