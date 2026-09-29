import type { Page } from '@playwright/test';

import { MESSENGER_ORDER } from '../src/entities/messenger/config';
import type { MessengerId } from '../src/entities/messenger/model';
import { expect, test } from './fixtures';
import { signInAndCreateChat } from './helpers';

const COLOR_SCHEMES = ['light', 'dark'] as const;
const MOBILE_VIEWPORT = { height: 844, width: 390 };
const MOBILE_MESSENGER_ID: MessengerId = 'max';
const OUTGOING_MESSAGE = 'Привет';
const ECHO_MESSAGE = 'Эхо: Привет';
const READ_STATUS_LABEL = 'Прочитано';
const REPLY_TIMEOUT_MS = 5000;

function getFace(page: Page, messengerId: MessengerId) {
  return page.locator(`section[data-messenger="${messengerId}"]`);
}

async function sendMessageAndWaitForEcho(page: Page, messengerId: MessengerId) {
  const face = getFace(page, messengerId);

  await face.getByLabel('Сообщение').fill(OUTGOING_MESSAGE);
  await face.getByRole('button', { name: 'Отправить' }).click();

  await expect(face.getByText(ECHO_MESSAGE)).toBeVisible({ timeout: REPLY_TIMEOUT_MS });
  await expect(face.getByLabel(READ_STATUS_LABEL)).toBeVisible({ timeout: REPLY_TIMEOUT_MS });
}

function getScreenshotOptions(page: Page) {
  return { mask: [page.locator('time')] };
}

for (const colorScheme of COLOR_SCHEMES) {
  test.describe(`${colorScheme} theme`, { tag: '@visual' }, () => {
    test.use({ colorScheme });

    for (const messengerId of MESSENGER_ORDER) {
      test(`${messengerId}: login screen`, async ({ page }) => {
        await page.goto(messengerId);
        await expect(
          getFace(page, messengerId).getByRole('button', { name: 'Войти в демо' }),
        ).toBeVisible();

        await expect(page).toHaveScreenshot(`${messengerId}-${colorScheme}-login.png`);
      });

      test(`${messengerId}: chat with echo reply`, async ({ page }) => {
        await signInAndCreateChat(page, messengerId);
        await sendMessageAndWaitForEcho(page, messengerId);

        await expect(page).toHaveScreenshot(
          `${messengerId}-${colorScheme}-chat.png`,
          getScreenshotOptions(page),
        );
      });
    }

    test.describe('mobile', () => {
      test.use({ viewport: MOBILE_VIEWPORT });

      test(`${MOBILE_MESSENGER_ID}: chat and chat list`, async ({ page }) => {
        const face = getFace(page, MOBILE_MESSENGER_ID);

        await signInAndCreateChat(page, MOBILE_MESSENGER_ID);
        await sendMessageAndWaitForEcho(page, MOBILE_MESSENGER_ID);
        await expect(page).toHaveScreenshot(
          `${MOBILE_MESSENGER_ID}-${colorScheme}-mobile-chat.png`,
          getScreenshotOptions(page),
        );

        await face.getByRole('link', { name: 'Назад к чатам' }).click();
        await expect(face.getByRole('navigation', { name: 'Чаты' })).toBeVisible();
        await expect(page).toHaveScreenshot(
          `${MOBILE_MESSENGER_ID}-${colorScheme}-mobile-list.png`,
        );
      });
    });

    test('privacy page', async ({ page }) => {
      await page.goto('privacy');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      await expect(page).toHaveScreenshot(`privacy-${colorScheme}.png`);
    });
  });
}
