import { expect, test } from '@playwright/test'

const titles = [
  'SQL-редактор и запуск',
  'Интерактивная схема',
  'Управление схемой',
  'Настройка экрана',
  'Запросы и история',
  'Материалы и задания',
  'Сценарий, ссылка и помощь',
]

test('онбординг содержит семь шагов и корректные границы навигации', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Интернет-магазин.*5 таблиц/s }).click()
  await expect(page.getByRole('dialog', { name: titles[0] })).toBeVisible({ timeout: 90000 })
  await expect(page.getByText('1 / 7', { exact: true })).toBeVisible()
  const card = await page.getByRole('dialog').boundingBox()
  const editor = await page.locator('[data-guide="sql-editor"]').boundingBox()
  const overlapWidth = Math.max(0, Math.min(card!.x + card!.width, editor!.x + editor!.width) - Math.max(card!.x, editor!.x))
  const overlapHeight = Math.max(0, Math.min(card!.y + card!.height, editor!.y + editor!.height) - Math.max(card!.y, editor!.y))
  expect(overlapWidth * overlapHeight).toBe(0)
  await expect(page.getByRole('button', { name: 'Назад', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Пропустить', exact: true })).toBeVisible()

  for (let index = 1; index < titles.length; index++) {
    await page.getByRole('button', { name: 'Далее', exact: true }).click()
    await expect(page.getByRole('dialog', { name: titles[index] })).toBeVisible()
    await expect(page.getByText(`${index + 1} / 7`, { exact: true })).toBeVisible()
  }
  await expect(page.getByRole('button', { name: 'Пропустить', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Назад', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Начать работу' })).toBeVisible()
  await page.getByRole('button', { name: 'Начать работу' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.reload()
  await expect(page.getByRole('button', { name: 'Выполнить', exact: true })).toBeVisible({ timeout: 90000 })
  await page.waitForTimeout(500)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Гайд по интерфейсу' }).click()
  await expect(page.getByRole('dialog', { name: titles[0] })).toBeVisible()
})

test('карточка гайда не перекрывает раскрытую панель заметок', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Онлайн-кинотеатр.*6 таблиц/s }).click()
  await expect(page.getByRole('dialog', { name: titles[0] })).toBeVisible({ timeout: 90000 })
  await page.getByRole('button', { name: 'Пропустить', exact: true }).click()
  await page.getByRole('button', { name: 'Гайд по интерфейсу' }).click()
  for (let index = 1; index < 6; index++) await page.getByRole('button', { name: 'Далее', exact: true }).click()
  await expect(page.getByRole('dialog', { name: titles[5] })).toBeVisible()
  const card = await page.getByRole('dialog').boundingBox()
  const notes = await page.locator('[data-guide="notes"]').boundingBox()
  expect(card).not.toBeNull()
  expect(notes).not.toBeNull()
  expect(card!.x + card!.width).toBeLessThanOrEqual(notes!.x - 8)
})
