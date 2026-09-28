import { expect, test } from './fixtures';
import { DEMO_PHONES } from './helpers';

const OUTGOING_MESSAGE = 'Привет с клавиатуры';
const ECHO_MESSAGE = 'Эхо: Привет с клавиатуры';
const REPLY_TIMEOUT_MS = 5000;

test.describe('keyboard shortcuts', () => {
  test('Ctrl+1/2/3 switch the active face and move focus to its heading', async ({ page }) => {
    await page.goto('max');

    await page.keyboard.press('Control+2');
    await expect(
      page.locator('section[data-messenger="whatsapp"]').getByRole('heading', { level: 2 }),
    ).toBeFocused();

    await page.keyboard.press('Control+3');
    await expect(
      page.locator('section[data-messenger="telegram"]').getByRole('heading', { level: 2 }),
    ).toBeFocused();

    await page.keyboard.press('Control+1');
    await expect(
      page.locator('section[data-messenger="max"]').getByRole('heading', { level: 2 }),
    ).toBeFocused();
  });

  test('Ctrl+K opens the command palette and a tab can be chosen with the keyboard', async ({
    page,
  }) => {
    await page.goto('max');

    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog', { name: 'Палитра команд' });
    await expect(dialog).toBeVisible();

    await page.keyboard.type('WhatsApp');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await expect(dialog).toBeHidden();
    await expect(
      page.locator('section[data-messenger="whatsapp"]').getByRole('heading', { level: 2 }),
    ).toBeFocused();
  });
});

test.describe('keyboard-only demo flow', () => {
  test('demo login, chat creation and sending a message work without a mouse', async ({ page }) => {
    await page.goto('max');
    const face = page.locator('section[data-messenger="max"]');

    await face.getByRole('button', { name: 'Войти в демо' }).focus();
    await page.keyboard.press('Enter');

    await face.getByLabel('Номер телефона').focus();
    await page.keyboard.type(DEMO_PHONES.max);
    await page.keyboard.press('Tab');
    await expect(face.getByRole('button', { name: 'Создать чат' })).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(face.getByLabel('Сообщение')).toBeVisible();
    await face.getByLabel('Сообщение').focus();
    await page.keyboard.type(OUTGOING_MESSAGE);
    await page.keyboard.press('Enter');

    await expect(face.getByText(ECHO_MESSAGE)).toBeVisible({ timeout: REPLY_TIMEOUT_MS });
  });

  test('Tab navigation shows a visible focus ring on interactive elements', async ({ page }) => {
    await page.goto('max');

    await page.keyboard.press('Tab');
    const outline = await page.evaluate(() => {
      const element = document.activeElement ?? document.body;
      const style = window.getComputedStyle(element);
      return { boxShadow: style.boxShadow, outlineStyle: style.outlineStyle };
    });

    const hasVisibleFocus = outline.outlineStyle !== 'none' || outline.boxShadow !== 'none';
    expect(hasVisibleFocus).toBe(true);
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('face switch skips the cube rotation animation', async ({ page }) => {
    await page.goto('max');

    await page.keyboard.press('Control+2');

    const face = page.locator('section[data-messenger="whatsapp"]');
    await expect(face.getByRole('heading', { level: 2 })).toBeFocused();

    const cubeTransform = await page.evaluate(() => {
      const cube = document.querySelector<HTMLElement>('.cube');
      return cube === null ? null : window.getComputedStyle(cube).transform;
    });
    expect(cubeTransform).toBe('none');
  });
});
