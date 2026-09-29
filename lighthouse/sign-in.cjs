const { Locator } = require('puppeteer-core');

const DEMO_PHONE = '+79001234567';
const MESSENGER_PATH_INDEX = 2;

module.exports = async (browser, { url }) => {
  // Each signed-in face holds an event stream open; Lighthouse waits for at most two open requests.
  await browser.deleteCookie(...(await browser.cookies()));

  const page = await browser.newPage();
  const messenger = new URL(url).pathname.split('/')[MESSENGER_PATH_INDEX];
  const face = `section[data-messenger="${messenger}"]`;

  const composer = page.locator(`${face} ::-p-aria(Сообщение)`);
  const signInButton = page.locator(`${face} ::-p-aria(Войти в демо)`);

  await page.goto(url);
  const firstReady = await Locator.race([composer, signInButton]).waitHandle();

  if (await firstReady.evaluate((element) => element.tagName === 'BUTTON')) {
    await firstReady.click();
    await page.locator(`${face} ::-p-aria(Номер телефона)`).fill(DEMO_PHONE);
    await page.locator(`${face} ::-p-aria(Создать чат)`).click();
    await composer.wait();
  }

  await page.close();
};
