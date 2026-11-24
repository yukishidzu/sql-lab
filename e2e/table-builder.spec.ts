import { expect, test } from './fixtures'

test('конструктор создаёт таблицу с PK/FK на суррогатный ключ', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Авиаперелёты.*7 таблиц/s }).click()
  await expect(page.getByRole('button', { name: 'Выполнить', exact: true })).toBeVisible({ timeout: 90000 })
  await page.getByRole('button', { name: 'Сценарий', exact: true }).click()
  await page.getByRole('button', { name: 'Новая таблица', exact: true }).click()
  await page.getByPlaceholder('products').fill('boarding_copy')

  await expect(page.getByRole('combobox', { name: 'Тип колонки 1' })).toHaveValue('integer')
  await page.getByRole('textbox', { name: 'Имя колонки 2' }).fill('ticket_flight_id')
  await page.getByRole('combobox', { name: 'Таблица FK 2' }).selectOption('ticket_flights')
  await page.getByRole('combobox', { name: 'Колонка FK 2' }).selectOption('id')
  await expect(page.getByRole('combobox', { name: 'Тип колонки 2' })).toHaveValue('integer')
  await page.getByRole('region', { name: 'Колонка 2' }).getByRole('checkbox', { name: 'PK' }).check()

  await page.getByRole('button', { name: 'Показать DDL' }).click()
  const preview = page.getByRole('textbox', { name: 'DDL новой таблицы' })
  await expect(preview).toHaveValue(/"ticket_flight_id" integer REFERENCES "ticket_flights" \("id"\)/)
  await page.getByRole('button', { name: 'Добавить в DDL' }).click()
  await expect(page.getByRole('textbox', { name: 'DDL PostgreSQL' })).toHaveValue(/CREATE TABLE "boarding_copy"/)
  page.once('dialog', (dialog) => void dialog.accept())
  await page.getByRole('button', { name: 'Проверить и применить' }).click()
  await expect(page.getByRole('dialog', { name: 'Редактор сценария' })).toHaveCount(0, { timeout: 90000 })
  await expect(page.locator('[data-id="boarding_copy"] [data-column="ticket_flight_id"] [data-keys]')).toHaveAttribute('data-keys', 'PKFK')
})
