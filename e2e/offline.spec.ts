import { expect, test } from './fixtures';
import { signInAndCreateChat } from './helpers';

const OFFLINE_NOTICE = 'Нет подключения к интернету. Отправка недоступна';
const OUTGOING_MESSAGE = 'Сообщение после восстановления связи';
const ECHO_MESSAGE = 'Эхо: Сообщение после восстановления связи';
const REPLY_TIMEOUT_MS = 5000;

test.describe('offline handling', () => {
  test('going offline shows a banner and disables sending; coming back restores it', async ({
    context,
    page,
  }) => {
    await signInAndCreateChat(page, 'max');
    const face = page.locator('section[data-messenger="max"]');

    await context.setOffline(true);
    await expect(page.getByText(OFFLINE_NOTICE)).toBeVisible();
    await face.getByLabel('Сообщение').fill('test');
    await expect(face.getByRole('button', { name: 'Отправить' })).toBeDisabled();

    await context.setOffline(false);
    await expect(page.getByText(OFFLINE_NOTICE)).toBeHidden();
    await expect(face.getByRole('button', { name: 'Отправить' })).toBeEnabled();
  });

  test('a message sent after reconnecting still gets an echo reply over SSE', async ({
    context,
    page,
  }) => {
    await signInAndCreateChat(page, 'max');
    const face = page.locator('section[data-messenger="max"]');

    await context.setOffline(true);
    await expect(page.getByText(OFFLINE_NOTICE)).toBeVisible();
    await context.setOffline(false);
    await expect(page.getByText(OFFLINE_NOTICE)).toBeHidden();

    await face.getByLabel('Сообщение').fill(OUTGOING_MESSAGE);
    await face.getByRole('button', { name: 'Отправить' }).click();

    await expect(face.getByText(ECHO_MESSAGE)).toBeVisible({ timeout: REPLY_TIMEOUT_MS });
  });
});
