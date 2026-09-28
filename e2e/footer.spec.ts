import { expect, test } from './fixtures';
import { signInAndCreateChat } from './helpers';

const DEMO_NOTICE = 'Демонстрационная версия.';
const MAIN_TEXT =
  'Приложение не соединяется с серверами мессенджеров напрямую — все запросы идут через API GREEN-API.';
const WHATSAPP_FOOTNOTE =
  '* WhatsApp принадлежит компании Meta Platforms Inc., деятельность которой признана экстремистской и запрещена на территории РФ';

test.describe('footer', () => {
  test('always shows the legal notice and the WhatsApp footnote in the mock instance', async ({
    page,
  }) => {
    await page.goto('max');

    const footer = page.locator('footer');
    await expect(footer.getByText(DEMO_NOTICE)).toBeVisible();
    await expect(footer.getByText(MAIN_TEXT)).toBeVisible();
    await expect(footer.getByText(WHATSAPP_FOOTNOTE)).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Конфиденциальность' })).toBeVisible();
  });
});

test.describe('footer @real', () => {
  test('shows the demo notice only after a demo login in a real-mode-enabled instance', async ({
    page,
  }) => {
    await page.goto('max');
    const footer = page.locator('footer');

    await expect(footer.getByText(DEMO_NOTICE)).toBeHidden();

    await signInAndCreateChat(page, 'max');

    await expect(footer.getByText(DEMO_NOTICE)).toBeVisible();
  });
});
