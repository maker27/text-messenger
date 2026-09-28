import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

import { FaceError } from './face-error';

test('announces the failure and retries on click', async () => {
  const handleRetry = vi.fn();
  render(<FaceError messenger="telegram" onRetry={handleRetry} />);

  expect(screen.getByRole('alert')).toHaveTextContent('Не удалось показать экран');
  expect(screen.getByRole('heading', { name: 'Telegram' })).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));

  expect(handleRetry).toHaveBeenCalledOnce();
});
