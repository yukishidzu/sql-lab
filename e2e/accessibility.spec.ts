import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('главная страница не имеет автоматически обнаруживаемых нарушений', async ({ page }) => {
  await page.goto('/')
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
})

test('рабочее пространство доступно автоматической проверке', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Онлайн-кинотеатр.*6 таблиц/s }).click()
  await expect(page.getByRole('button', { name: 'Выполнить', exact: true })).toBeVisible({ timeout: 90000 })
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
})
