import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import NotFound from './not-found';

test('explains the missing page in Russian and links back to MAX', () => {
  render(<NotFound />);

  expect(screen.getByRole('heading', { name: 'Страница не найдена' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Перейти к MAX' })).toHaveAttribute('href', '/max');
});
