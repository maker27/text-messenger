import type { Page } from '@playwright/test';

import { MESSENGER_ORDER } from '../src/entities/messenger/config';
import type { Theme } from '../src/shared/theme/theme';
import { THEME_COOKIE_NAME } from '../src/shared/theme/theme';
import { expect, test } from './fixtures';
import { DEMO_PHONES } from './helpers';

const THEMES: Theme[] = ['light', 'dark'];
const COOKIE_PATH = '/text-messenger';
const SCROLLABLE_REGION_RULE = 'scrollable-region-focusable';

function getSeriousOrCritical(violations: { id: string; impact?: string | null }[]) {
  return violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => violation.id);
}

async function setTheme(page: Page, theme: Theme) {
  await page.context().addCookies([
    {
      domain: 'localhost',
      name: THEME_COOKIE_NAME,
      path: COOKIE_PATH,
      value: theme,
    },
  ]);
}

test.describe('a11y matrix', () => {
  for (const messengerId of MESSENGER_ORDER) {
    for (const theme of THEMES) {
      test(`${messengerId}/${theme}: login, chat list, chat and palette have no serious or critical violations`, async ({
        makeAxeBuilder,
        page,
      }) => {
        await setTheme(page, theme);
        await page.goto(messengerId);
        await expect(page).toHaveTitle(/\S/);

        const loginResults = await makeAxeBuilder(page).analyze();
        expect(getSeriousOrCritical(loginResults.violations)).toEqual([]);

        const face = page.locator(`section[data-messenger="${messengerId}"]`);
        await face.getByRole('button', { name: 'Войти в демо' }).click();
        await expect(face.getByLabel('Номер телефона')).toBeVisible();

        await expect(page).toHaveTitle(/\S/);
        const listResults = await makeAxeBuilder(page).analyze();
        expect(getSeriousOrCritical(listResults.violations)).toEqual([]);

        await face.getByLabel('Номер телефона').fill(DEMO_PHONES[messengerId]);
        await face.getByRole('button', { name: 'Создать чат' }).click();
        await expect(face.getByLabel('Сообщение')).toBeVisible();

        // Client-side navigation to the chat route briefly clears <title> while Next
        // swaps the head; wait for it to settle before scanning, otherwise axe's
        // document-title check can catch the page mid-transition.
        await expect(page).toHaveTitle(/\S/);
        const chatResults = await makeAxeBuilder(page).analyze();
        expect(getSeriousOrCritical(chatResults.violations)).toEqual([]);

        await page.keyboard.press('Control+k');
        const dialog = page.getByRole('dialog', { name: 'Палитра команд' });
        await expect(dialog).toBeVisible();

        // The palette menu follows the combobox pattern: focus stays on the input and
        // options are tracked via aria-activedescendant, so its scroll region is not tabbable.
        const paletteResults = await makeAxeBuilder(page)
          .disableRules([SCROLLABLE_REGION_RULE])
          .analyze();
        expect(getSeriousOrCritical(paletteResults.violations)).toEqual([]);
      });
    }
  }

  for (const theme of THEMES) {
    test(`privacy page/${theme}: no serious or critical violations`, async ({
      makeAxeBuilder,
      page,
    }) => {
      await setTheme(page, theme);
      await page.goto('privacy');
      await expect(page).toHaveTitle(/\S/);

      const results = await makeAxeBuilder(page).analyze();
      expect(getSeriousOrCritical(results.violations)).toEqual([]);
    });
  }
});
