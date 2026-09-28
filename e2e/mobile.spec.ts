import { expect, test } from './fixtures';
import { signInAndCreateChat } from './helpers';

interface ElementBox {
  height: number;
  width: number;
  x: number;
  y: number;
}

const MOBILE_VIEWPORT = { height: 640, width: 320 };
const OUTGOING_MESSAGE = 'Мобильное сообщение';
const HAS_HORIZONTAL_SCROLL_SCRIPT = () =>
  document.documentElement.scrollWidth > document.documentElement.clientWidth;

function assertBox(box: ElementBox | null): ElementBox {
  if (box === null) {
    throw new Error('expected an element with a bounding box');
  }
  return box;
}

test.describe('mobile layout', () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test('login screen fits without horizontal scroll', async ({ page }) => {
    await page.goto('max');
    expect(await page.evaluate(HAS_HORIZONTAL_SCROLL_SCRIPT)).toBe(false);
  });

  test('chat screen fits without horizontal scroll', async ({ page }) => {
    await signInAndCreateChat(page, 'max');
    expect(await page.evaluate(HAS_HORIZONTAL_SCROLL_SCRIPT)).toBe(false);
  });

  test('chat list, chat view and back navigation work on a narrow viewport', async ({ page }) => {
    await signInAndCreateChat(page, 'max');
    const face = page.locator('section[data-messenger="max"]');

    await face.getByRole('link', { name: 'Назад к чатам' }).click();
    await expect(face.getByRole('navigation', { name: 'Чаты' })).toBeVisible();

    await face.getByRole('navigation', { name: 'Чаты' }).getByRole('link').first().click();
    await expect(face.getByLabel('Сообщение')).toBeVisible();
  });

  test('the composer stays below the last message', async ({ page }) => {
    await signInAndCreateChat(page, 'max');
    const face = page.locator('section[data-messenger="max"]');

    await face.getByLabel('Сообщение').fill(OUTGOING_MESSAGE);
    await face.getByRole('button', { name: 'Отправить' }).click();
    await expect(face.getByText(OUTGOING_MESSAGE)).toBeVisible();

    // The bubble's status updates shortly after sending (Sent/Delivered/Read), which can
    // re-render it between the visibility check and boundingBox(); poll until both boxes
    // are available in the same tick instead of racing a single read.
    await expect(async () => {
      const messageBox = assertBox(await face.getByText(OUTGOING_MESSAGE).boundingBox());
      const composerBox = assertBox(await face.getByLabel('Сообщение').boundingBox());

      expect(messageBox.y + messageBox.height).toBeLessThanOrEqual(composerBox.y + 1);
    }).toPass();
  });
});
