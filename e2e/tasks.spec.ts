import { expect, test, type Page } from './fixtures'

async function writeSql(page: Page, sql: string) {
  const editor = page.locator('.cm-content:visible')
  await editor.click()
  await editor.press('Control+A')
  await editor.pressSequentially(sql)
}

test('автопроверка принимает эталон и позволяет добавить своё задание', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Интернет-магазин.*5 таблиц.*10 заданий/s }).click()
  await expect(page.getByRole('button', { name: 'Выполнить', exact: true })).toBeVisible({ timeout: 90000 })
  await page.getByRole('button', { name: 'Задания', exact: true }).click()
  await expect(page.getByText('1. Дорогие активные товары', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Проверить решение' }).click()
  await expect(page.getByRole('status')).toContainText('не совпадает')
  await writeSql(page, 'SELECT name, price, stock_qty FROM products WHERE is_active AND price > 3000 ORDER BY price DESC, id LIMIT 5')
  await page.getByRole('button', { name: 'Проверить решение' }).click()
  await expect(page.getByRole('status')).toContainText('Задание принято')

  await page.getByRole('button', { name: 'Новое задание', exact: true }).click()
  await page.getByRole('textbox', { name: 'Название задания' }).fill('Число клиентов')
  await page.getByRole('textbox', { name: 'Условие задания' }).fill('Выведите одно число — количество клиентов.')
  await page.getByRole('textbox', { name: 'Эталонный SQL' }).fill('SELECT COUNT(*) AS total FROM customers')
  await page.getByRole('checkbox', { name: 'Сравнивать названия и порядок колонок' }).check()
  await page.getByRole('button', { name: 'Сохранить задание' }).click()
  await expect(page.getByText('11. Число клиентов', { exact: true })).toBeVisible()
  await writeSql(page, 'SELECT COUNT(*) AS total FROM customers')
  await page.getByRole('button', { name: 'Проверить решение' }).click()
  await expect(page.getByRole('status')).toContainText('Задание принято: 1 строка')

  await page.reload()
  await expect(page.getByRole('button', { name: 'Выполнить', exact: true })).toBeVisible({ timeout: 90000 })
  await page.getByRole('button', { name: 'Задания', exact: true }).click()
  await page.getByText('11. Число клиентов', { exact: true }).click()
  await expect(page.getByText('Выведите одно число — количество клиентов.')).toBeVisible()
})

test('ERD распознаёт обе формы связующих таблиц M:N', async ({ page }) => {
  for (const [preset, tables] of [['Интернет-магазин.*5 таблиц', 'order_items'], ['Онлайн-кинотеатр.*6 таблиц', 'movie_genres'], ['Авиаперелёты.*7 таблиц', 'ticket_flights']] as const) {
    await page.goto('/')
    await page.getByRole('button', { name: new RegExp(preset, 's') }).click()
    await expect(page.getByRole('button', { name: 'Выполнить', exact: true })).toBeVisible({ timeout: 90000 })
    await expect(page.locator(`[data-id="${tables}"]`).getByText('M:N', { exact: true })).toBeVisible()
  }
})
