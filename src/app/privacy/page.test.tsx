import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import PrivacyPage from './page';

test('describes the processed data, purpose and retention', () => {
  render(<PrivacyPage />);

  expect(screen.getByRole('heading', { level: 1, name: 'Конфиденциальность' })).toBeInTheDocument();
  expect(
    screen.getAllByRole('heading', { level: 2 }).map(({ textContent }) => textContent),
  ).toEqual(['Какие данные', 'Зачем', 'Сколько хранятся', 'Что не хранится']);
});

test('states where each kind of data is kept', () => {
  render(<PrivacyPage />);

  expect(
    screen.getByText(/отдельной зашифрованной cookie для каждого мессенджера/),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/идентификатор чата, название и время последнего сообщения/),
  ).toBeInTheDocument();
  expect(screen.getByText(/Cookie с данными инстанса живёт 24 часа/)).toBeInTheDocument();
  expect(screen.getByText(/не записывает их в журналы/)).toBeInTheDocument();
});

test('links back to the messengers', () => {
  render(<PrivacyPage />);

  expect(screen.getByRole('link', { name: 'Назад' })).toHaveAttribute('href', '/');
});
