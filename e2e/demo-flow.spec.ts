import { MESSENGER_ORDER } from '../src/entities/messenger/config';
import { expect, test } from './fixtures';
import { signInAndCreateChat } from './helpers';

const OUTGOING_MESSAGE = 'Привет';
const ECHO_MESSAGE = 'Эхо: Привет';
const DELIVERED_STATUS_LABEL = 'Доставлено';
const READ_STATUS_LABEL = 'Прочитано';
const DEMO_TOKEN_PATTERN = /(?<![0-9a-z])[0-9a-z]{50}(?![0-9a-z])/;
const REPLY_TIMEOUT_MS = 5000;

test.describe('demo flow', () => {
  for (const messengerId of MESSENGER_ORDER) {
    test(`${messengerId}: demo login, chat, echo and read status`, async ({ page }) => {
      const face = page.locator(`section[data-messenger="${messengerId}"]`);

      await signInAndCreateChat(page, messengerId);

      await face.getByLabel('Сообщение').fill(OUTGOING_MESSAGE);
      await face.getByRole('button', { name: 'Отправить' }).click();

      await expect(face.getByLabel(DELIVERED_STATUS_LABEL)).toBeVisible();
      await expect(face.getByText(ECHO_MESSAGE)).toBeVisible({ timeout: REPLY_TIMEOUT_MS });
      await expect(face.getByLabel(READ_STATUS_LABEL).last()).toBeVisible({
        timeout: REPLY_TIMEOUT_MS,
      });

      const html = await page.content();
      expect(DEMO_TOKEN_PATTERN.test(html)).toBe(false);
    });
  }
});

test.describe('a11y smoke', () => {
  test('login screen has no serious or critical violations', async ({ makeAxeBuilder, page }) => {
    await page.goto('max');

    const results = await makeAxeBuilder(page).analyze();

    expect(getSeriousOrCritical(results.violations)).toEqual([]);
  });

  test('chat screen has no serious or critical violations', async ({ makeAxeBuilder, page }) => {
    await signInAndCreateChat(page, 'max');

    const results = await makeAxeBuilder(page).analyze();

    expect(getSeriousOrCritical(results.violations)).toEqual([]);
  });
});

function getSeriousOrCritical(violations: { id: string; impact?: string | null }[]) {
  return violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => violation.id);
}
