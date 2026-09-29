import { render, screen } from '@testing-library/react';
import { useSelectedLayoutSegment } from 'next/navigation';
import { expect, test, vi } from 'vitest';

import { FaceSidebar } from './face-sidebar';

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useSelectedLayoutSegment: vi.fn(),
}));

const CHAT_SEGMENT = '79161234567';

function renderSidebar() {
  render(
    <FaceSidebar>
      <p>Чаты</p>
    </FaceSidebar>,
  );

  return screen.getByText('Чаты').parentElement;
}

test('shows the sidebar on every screen width when no chat is open', () => {
  vi.mocked(useSelectedLayoutSegment).mockReturnValue(null);

  expect(renderSidebar()).not.toHaveClass('hidden');
});

test('hides the sidebar on narrow screens when a chat is open', () => {
  vi.mocked(useSelectedLayoutSegment).mockReturnValue(CHAT_SEGMENT);

  expect(renderSidebar()).toHaveClass('hidden', 'md:flex');
});
