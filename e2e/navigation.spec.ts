import { expect, test } from './fixtures';
import { signInAndCreateChat } from './helpers';

const DRAFT_MESSAGE = 'Черновик сообщения';
const STORAGE_KEY_PREFIX = 'tm:max:';
const SECOND_CHAT_PHONE = '+79007654321';
const PHONE_DRAFT = '+7900';
const FORMATTED_PHONE_DRAFT = '+7 900';
const RSC_HEADER = 'rsc';
const PREFETCH_HEADER = 'next-router-prefetch';

test.describe('navigation state persistence', () => {
  test('composer draft survives switching faces via Ctrl+1/2', async ({ page }) => {
    await signInAndCreateChat(page, 'max');
    const maxFace = page.locator('section[data-messenger="max"]');
    await maxFace.getByLabel('Сообщение').fill(DRAFT_MESSAGE);

    await page.keyboard.press('Control+2');
    const whatsappFace = page.locator('section[data-messenger="whatsapp"]');
    await expect(whatsappFace.getByRole('heading', { level: 2 })).toBeFocused();

    await page.keyboard.press('Control+1');
    await expect(maxFace.getByRole('heading', { level: 2 })).toBeFocused();
    await expect(maxFace.getByLabel('Сообщение')).toHaveValue(DRAFT_MESSAGE);
  });

  test('chat list and selected chat survive a hard reload', async ({ page }) => {
    await signInAndCreateChat(page, 'max');
    const face = page.locator('section[data-messenger="max"]');
    const chatUrl = page.url();

    await page.reload();

    await expect(face.getByLabel('Сообщение')).toBeVisible();
    expect(page.url()).toBe(chatUrl);
  });

  test('a deep link to an existing chat opens it directly after reload', async ({ page }) => {
    await signInAndCreateChat(page, 'max');
    const chatUrl = page.url();

    await page.goto(chatUrl);

    const face = page.locator('section[data-messenger="max"]');
    await expect(face.getByLabel('Сообщение')).toBeVisible();
  });

  test('switching chats shows the chat skeleton before the server responds', async ({ page }) => {
    await signInAndCreateChat(page, 'max');
    const face = page.locator('section[data-messenger="max"]');
    const firstChatPath = new URL(page.url()).pathname;
    await face.getByLabel('Номер телефона').fill(SECOND_CHAT_PHONE);
    await face.getByRole('button', { name: 'Создать чат' }).click();
    await expect(page).not.toHaveURL(firstChatPath);
    await expect(face.getByLabel('Сообщение')).toBeVisible();
    await face.getByLabel('Номер телефона').fill(PHONE_DRAFT);

    const { promise: serverResponse, resolve: releaseServerResponse } =
      Promise.withResolvers<undefined>();
    await page.route(`**${firstChatPath}**`, async (route) => {
      const headers = route.request().headers();
      if (headers[RSC_HEADER] !== undefined && headers[PREFETCH_HEADER] === undefined) {
        await serverResponse;
      }
      await route.continue();
    });
    await face.locator(`a[href="${firstChatPath}"]`).click();

    await expect(page).toHaveURL(firstChatPath);
    await expect(face.getByRole('status').filter({ hasText: 'Загрузка сообщений' })).toBeVisible();
    releaseServerResponse(undefined);
    await expect(face.getByLabel('Сообщение')).toBeVisible();
    await expect(face.getByLabel('Номер телефона')).toHaveValue(FORMATTED_PHONE_DRAFT);
  });

  test('logout clears the messenger session from local storage', async ({ page }) => {
    await signInAndCreateChat(page, 'max');

    const keysBeforeLogout = await page.evaluate(
      (prefix) => Object.keys(window.localStorage).filter((key) => key.startsWith(prefix)),
      STORAGE_KEY_PREFIX,
    );
    expect(keysBeforeLogout.length).toBeGreaterThan(0);

    const face = page.locator('section[data-messenger="max"]');
    await face.getByRole('button', { name: 'Выйти' }).click();
    await expect(face.getByRole('button', { name: 'Войти в демо' })).toBeVisible();

    const keysAfterLogout = await page.evaluate(
      (prefix) => Object.keys(window.localStorage).filter((key) => key.startsWith(prefix)),
      STORAGE_KEY_PREFIX,
    );
    expect(keysAfterLogout).toEqual([]);
  });
});
