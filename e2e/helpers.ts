import type { Page } from '@playwright/test';

import type { MessengerId } from '../src/entities/messenger/model';
import { expect } from './fixtures';

export const DEMO_PHONES = {
  max: '+79001234567',
  telegram: '+79001234567',
  whatsapp: '79001234567',
} satisfies Record<MessengerId, string>;

const NON_EMPTY_PATTERN = /\S/;

export async function signInAndCreateChat(page: Page, messengerId: MessengerId) {
  await page.goto(messengerId);
  const face = page.locator(`section[data-messenger="${messengerId}"]`);
  await face.getByRole('button', { name: 'Войти в демо' }).click();
  await face.getByLabel('Номер телефона').fill(DEMO_PHONES[messengerId]);
  await face.getByRole('button', { name: 'Создать чат' }).click();
  await expect(face.getByLabel('Сообщение')).toBeVisible();
  await expect(page).toHaveTitle(NON_EMPTY_PATTERN);
}
