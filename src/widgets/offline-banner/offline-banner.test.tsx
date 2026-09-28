import { render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { OfflineBanner } from './offline-banner';

afterEach(() => {
  vi.restoreAllMocks();
});

test('keeps an empty live region while online', () => {
  render(<OfflineBanner />);

  expect(screen.getByRole('status')).toBeEmptyDOMElement();
});

test('announces that sending is unavailable while offline', () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

  render(<OfflineBanner />);

  expect(screen.getByRole('status')).toHaveTextContent(
    'Нет подключения к интернету. Отправка недоступна',
  );
});
