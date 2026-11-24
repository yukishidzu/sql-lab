import { expect, test } from './fixtures'

test('PostgreSQL и WASM загружаются только после открытия пространства', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (request) => requests.push(request.url()))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Выберите учебный сценарий' })).toBeVisible()
  expect(requests.some((url) => url.includes('pglite') || url.endsWith('.wasm'))).toBe(false)
  await page.getByRole('button', { name: /Авиаперелёты.*7 таблиц/s }).click()
  await expect(page.getByRole('button', { name: 'Выполнить', exact: true })).toBeVisible({ timeout: 90000 })
  expect(requests.some((url) => url.includes('pglite-worker'))).toBe(true)
  expect(requests.some((url) => url.endsWith('.wasm'))).toBe(true)
})
