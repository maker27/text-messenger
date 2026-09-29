import type { Page } from '@playwright/test';

import type { MessengerId } from '../src/entities/messenger/model';
import { expect, test } from './fixtures';
import { DEMO_PHONES, signInAndCreateChat } from './helpers';

const VIDEO_PATH = 'test-results/showcase/demo.webm';
const OUTGOING_MESSAGE = 'Привет';
const ECHO_MESSAGE = 'Эхо: Привет';
const READ_STATUS_LABEL = 'Прочитано';
const REPLY_TIMEOUT_MS = 5000;

function getFace(page: Page, messengerId: MessengerId) {
  return page.locator(`section[data-messenger="${messengerId}"]`);
}

async function signInOnActiveFace(page: Page, messengerId: MessengerId) {
  const face = getFace(page, messengerId);

  await face.getByRole('button', { name: 'Войти в демо' }).click();
  await face.getByLabel('Номер телефона').pressSequentially(DEMO_PHONES[messengerId]);
  await face.getByRole('button', { name: 'Создать чат' }).click();
  await expect(face.getByLabel('Сообщение')).toBeVisible();
}

async function exchangeMessages(page: Page, messengerId: MessengerId) {
  const face = getFace(page, messengerId);

  await face.getByLabel('Сообщение').pressSequentially(OUTGOING_MESSAGE);
  await face.getByRole('button', { name: 'Отправить' }).click();

  await expect(face.getByText(ECHO_MESSAGE)).toBeVisible({ timeout: REPLY_TIMEOUT_MS });
  await expect(face.getByLabel(READ_STATUS_LABEL)).toBeVisible({ timeout: REPLY_TIMEOUT_MS });
}

async function expectFaceActive(page: Page, messengerId: MessengerId) {
  await expect(getFace(page, messengerId).getByRole('heading', { level: 2 })).toBeFocused();
}

async function saveVideo(page: Page) {
  const video = page.video();

  if (video === null) {
    throw new Error('Video recording is off for this project');
  }

  await page.close();
  await video.saveAs(VIDEO_PATH);
}

test('demo tour across the three messengers', { tag: '@showcase' }, async ({ page }) => {
  await signInAndCreateChat(page, 'max');
  await exchangeMessages(page, 'max');

  await page.keyboard.press('Control+2');
  await expectFaceActive(page, 'whatsapp');
  await signInOnActiveFace(page, 'whatsapp');
  await exchangeMessages(page, 'whatsapp');

  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: 'Палитра команд' });
  await expect(palette).toBeVisible();
  await page.keyboard.type('Telegram');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(palette).toBeHidden();
  await expectFaceActive(page, 'telegram');
  await signInOnActiveFace(page, 'telegram');

  await page.getByRole('button', { name: /Тема/ }).click();
  await page.getByRole('option', { name: 'Тёмная' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await exchangeMessages(page, 'telegram');

  await saveVideo(page);
});
