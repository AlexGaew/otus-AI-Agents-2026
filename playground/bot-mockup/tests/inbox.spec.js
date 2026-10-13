const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const PAGE = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;

async function send(page, text) {
  await page.getByTestId('input').fill(text);
  await page.getByTestId('send').click();
}

const lastBot = (page) => page.getByTestId('bot-message').last();

test.describe('макет бота «входящие»', () => {
  let problems;

  test.beforeEach(async ({ page }) => {
    problems = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') problems.push(`console: ${msg.text()}`);
    });
    page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
    await page.goto(PAGE);
  });

  test.afterEach(() => {
    expect(problems, 'в консоли не должно быть ошибок').toEqual([]);
  });

  test('ссылка: бот предлагает теги, после подтверждения запись находится поиском (F2, F3, F4)', async ({ page }) => {
    await send(page, 'https://spring.io/blog/java-21');

    await expect(lastBot(page)).toContainText('Сохранено');
    await expect(page.getByTestId('tag')).toHaveText(['#java', '#spring']);

    await page.getByTestId('confirm').click();
    await expect(lastBot(page)).toContainText('Теги подтверждены');

    await send(page, '/search spring');
    await expect(lastBot(page)).toContainText('Найдено: 1');
    await expect(lastBot(page)).toContainText('spring.io');

    await page.screenshot({ path: 'test-results/search.png', fullPage: true });
  });

  test('заметка: теги можно править кнопками до подтверждения (F1, F3)', async ({ page }) => {
    await send(page, 'купить молоко');
    await expect(page.getByTestId('tag')).toHaveText(['#заметка']);

    await page.getByTestId('tag').first().click();
    await expect(page.getByTestId('tag').first()).toHaveAttribute('aria-pressed', 'false');

    await page.getByTestId('confirm').click();
    await send(page, '/search молоко');
    await expect(lastBot(page)).toContainText('Найдено: 1');
  });

  test('поиск без совпадений сообщает об этом (F4)', async ({ page }) => {
    await send(page, 'купить молоко');
    await page.getByTestId('confirm').click();

    await send(page, '/search java');
    await expect(lastBot(page)).toContainText('Ничего не найдено');
  });

  test('дайджест группирует записи по тегам (F5)', async ({ page }) => {
    await send(page, 'https://spring.io/blog/java-21');
    await page.getByTestId('confirm').click();
    await send(page, 'купить молоко');
    await page.getByTestId('confirm').click();

    await send(page, '/digest');
    await expect(lastBot(page)).toContainText('Дайджест');
    await expect(page.getByTestId('digest-group')).toHaveText([/#java/, /#spring/, /#заметка/]);
  });
});
