import { expect, test, type Page } from './fixtures'

async function writeSql(page: Page, sql: string) {
  const editor = page.locator('.cm-content:visible')
  await editor.click()
  await editor.press('Control+A')
  await editor.pressSequentially(sql)
}

test('PostgreSQL, ERD, история, заметки и шаринг работают end-to-end', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Выберите учебный сценарий' })).toBeVisible()
  await page.getByRole('button', { name: /Авиаперелёты.*7 таблиц/s }).click()
  await expect(page.getByRole('button', { name: 'Выполнить', exact: true })).toBeVisible({ timeout: 90000 })
  await expect(page.locator('.react-flow__node')).toHaveCount(7)
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(false)

  await writeSql(page, 'SELECT flight_no, status FROM flights ORDER BY id;')
  await page.getByRole('button', { name: 'Выполнить', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'SL101', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'SL701', exact: true })).toBeVisible()

  await writeSql(page, 'SELECT * FROM missing_table;')
  await page.getByRole('button', { name: 'Выполнить', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('missing_table')

  await writeSql(page, 'SELECT code, city FROM airports ORDER BY code;')
  await page.getByRole('button', { name: 'Выполнить', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'Москва', exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await page.getByPlaceholder('Например: доход по месяцам').fill('Аэропорты')
  await page.getByRole('dialog').getByRole('button', { name: 'Сохранить', exact: true }).click()
  await page.getByRole('banner').getByRole('button', { name: 'Запросы', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Аэропорты', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'SELECT code, city FROM airports ORDER BY code;', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Закрыть панель', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Материалы: авиаперелёты' })).toBeVisible()
  await page.getByRole('button', { name: 'Редактировать заметки' }).click()
  const notes = page.getByRole('textbox', { name: 'Markdown-заметки' })
  await notes.fill('# Проверка\n\nСохранить эту заметку.')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Выполнить', exact: true })).toBeVisible({ timeout: 90000 })
  await expect(page.locator('.cm-content:visible')).toContainText('SELECT code, city FROM airports')
  await expect(page.getByRole('heading', { name: 'Проверка' })).toBeVisible()

  await page.getByRole('button', { name: 'Поделиться сценарием' }).click()
  const shareField = page.getByRole('textbox', { name: 'Ссылка на сценарий' })
  await expect(shareField).toHaveValue(/#\/import\//)
  const sharedUrl = await shareField.inputValue()
  const copy = await page.context().newPage()
  await copy.goto(sharedUrl)
  await expect(copy.getByRole('button', { name: 'Выполнить', exact: true })).toBeVisible({ timeout: 90000 })
  await expect(copy.getByRole('heading', { name: 'Проверка' })).toBeVisible()
  await copy.close()
  expect(errors).toEqual([])
})

test('экспорт создаёт полную резервную копию', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Онлайн-кинотеатр.*6 таблиц/s }).click()
  await expect(page.getByRole('button', { name: 'Выполнить', exact: true })).toBeVisible({ timeout: 90000 })
  const downloadPromise = page.waitForEvent('download', { timeout: 90000 })
  await page.getByRole('button', { name: 'Экспорт резервной копии' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toContain('.sqllab.json')
})
