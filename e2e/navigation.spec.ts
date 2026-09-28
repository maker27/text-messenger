import { expect, test } from './fixtures';
import { signInAndCreateChat } from './helpers';

const DRAFT_MESSAGE = 'Черновик сообщения';
const STORAGE_KEY_PREFIX = 'tm:max:';

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
