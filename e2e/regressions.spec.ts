import { expect, test, type Page } from './fixtures'

async function openShop(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /Интернет-магазин.*5 таблиц/s }).click()
  await expect(page.getByRole('button', { name: 'Выполнить', exact: true })).toBeVisible({ timeout: 90000 })
}

async function writeSql(page: Page, sql: string) {
  const editor = page.locator('.cm-content:visible')
  await editor.click()
  await editor.press('Control+A')
  await editor.pressSequentially(sql)
}

test('повторяющиеся имена колонок сохраняют независимые значения', async ({ page }) => {
  await openShop(page)
  await writeSql(page, 'SELECT o.id, oi.id FROM orders o JOIN order_items oi ON oi.order_id = o.id ORDER BY o.id, oi.id LIMIT 2;')
  await page.getByRole('button', { name: 'Выполнить', exact: true }).click()
  await expect(page.locator('tbody tr')).toHaveCount(2)
  const rows = await page.locator('tbody tr').evaluateAll((items) => items.map((row) => [...row.querySelectorAll('td')].map((cell) => cell.textContent)))
  expect(rows).toEqual([['1', '1'], ['1', '2']])

  await writeSql(page, 'SELECT generate_series(1, 250) AS n;')
  await page.getByRole('button', { name: 'Выполнить', exact: true }).click()
  await expect(page.getByText('250 строк', { exact: false })).toBeVisible()
  await expect(page.getByText('Показ ограничен интерфейсом')).toHaveCount(0)
})

test('проверка привязана к SQL, сохраняется и не меняет базу через WITH', async ({ page }) => {
  await openShop(page)
  await page.getByRole('button', { name: 'Задания', exact: true }).click()
  const correct = 'SELECT name, price, stock_qty FROM products WHERE is_active AND price > 3000 ORDER BY price DESC, id'
  await writeSql(page, correct)
  await page.getByRole('button', { name: 'Проверить решение' }).click()
  await expect(page.getByRole('status')).toContainText('Задание принято')
  await writeSql(page, 'SELECT name, price, stock_qty FROM products WHERE is_active AND price = 0 ORDER BY price DESC, id')
  await expect(page.getByRole('status')).toHaveCount(0)
  await writeSql(page, correct)
  await expect(page.getByRole('status')).toContainText('Задание принято')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Выполнить', exact: true })).toBeVisible({ timeout: 90000 })
  await page.getByRole('button', { name: 'Задания', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Задание принято')

  await writeSql(page, 'WITH changed AS (UPDATE products SET stock_qty = 99 WHERE id = 16 RETURNING *) SELECT * FROM changed')
  await page.getByRole('button', { name: 'Проверить решение' }).click()
  await expect(page.getByRole('status')).not.toContainText('Задание принято')
  await writeSql(page, 'SELECT stock_qty FROM products WHERE id = 16;')
  await page.getByRole('button', { name: 'Выполнить', exact: true }).click()
  await expect(page.locator('tbody td').first()).toHaveText('3')
})

test('LEFT JOIN предлагается при вводе второй части', async ({ page }) => {
  await openShop(page)
  await writeSql(page, 'SELECT * FROM products p LEFT J')
  await expect(page.locator('.sql-completion').filter({ hasText: /^LEFT JOIN$/ })).toBeVisible()
})
