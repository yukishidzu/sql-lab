import { expect, test } from '@playwright/test'

test('схема и результат скрываются, колонки меняются местами', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /HR и таск-трекер.*6 таблиц/s }).click()
  await expect(page.getByRole('button', { name: 'Выполнить', exact: true })).toBeVisible({ timeout: 90000 })
  await expect(page.getByRole('region', { name: 'ERD-схема базы данных' })).toBeVisible()
  await expect(page.getByText('Результат', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Скрыть результат' }).click()
  await expect(page.getByRole('button', { name: 'Показать результат' })).toBeVisible()
  await page.getByRole('button', { name: 'Показать результат' }).click()
  await expect(page.getByRole('button', { name: 'Скрыть результат' })).toBeVisible()

  await page.getByRole('button', { name: 'Скрыть схему' }).click()
  await expect(page.locator('.react-flow')).toHaveCount(0)
  await page.getByRole('button', { name: 'Схема', exact: true }).click()
  await expect(page.locator('.react-flow')).toBeVisible()
  const before = await page.locator('.react-flow').evaluate((element) => element.getBoundingClientRect().x)
  expect(before).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Поменять панели местами' }).click()
  await expect.poll(() => page.locator('.react-flow').evaluate((element) => element.getBoundingClientRect().x)).toBeLessThan(before)
})
