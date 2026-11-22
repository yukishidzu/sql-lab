import { expect, test } from '@playwright/test'

test('светлая ERD, компактная мини-карта и стабильные заметки', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  await page.getByRole('button', { name: /Авиаперелёты.*7 таблиц/s }).click()
  await expect(page.getByRole('button', { name: 'Выполнить', exact: true })).toBeVisible({ timeout: 90000 })

  await expect(page.locator('.react-flow')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(page.locator('.react-flow')).toHaveCSS('color-scheme', 'light')
  const minimap = await page.locator('.react-flow__minimap').boundingBox()
  expect(minimap?.width).toBeLessThanOrEqual(112)
  expect(minimap?.height).toBeLessThanOrEqual(76)
  await expect(page.locator('.react-flow__edge-text')).toHaveCount(0)
  await expect(page.locator('[data-handleid="departure_airport:source"]')).toHaveCSS('opacity', '0')
  await expect(page.locator('[data-id="boarding_passes"] [data-column="ticket_id"] [data-keys]')).toHaveAttribute('data-keys', 'PKFK')
  const columnStarts = await page.locator('[data-id="flights"] [data-column]').evaluateAll((columns) => columns.map((column) => column.children[1].getBoundingClientRect().x))
  expect(columnStarts.every((start) => Math.abs(start - columnStarts[0]) < 1)).toBe(true)
  await expect(page.locator('[data-id="flights"] [data-column="status"] [data-keys]')).toBeEmpty()

  const nodesWithinFlow = () => page.evaluate(() => {
    const flow = document.querySelector('.react-flow')!.getBoundingClientRect()
    return [...document.querySelectorAll('.react-flow__node')].every((element) => {
      const rect = element.getBoundingClientRect()
      return rect.left >= flow.left - 2 && rect.right <= flow.right + 2 && rect.top >= flow.top - 2 && rect.bottom <= flow.bottom + 2
    })
  })
  await expect.poll(nodesWithinFlow).toBe(true)
  await page.getByRole('button', { name: 'Открыть заметки' }).click()
  const notes = page.getByRole('complementary', { name: 'Заметки и задания' })
  await expect(notes).toHaveCSS('width', '340px')
  await page.getByRole('button', { name: 'Редактировать заметки' }).click()
  await expect(notes).toHaveCSS('width', '340px')
  await expect.poll(nodesWithinFlow).toBe(true)
  await expect(page.getByRole('button', { name: 'Просмотр Markdown' })).toBeVisible()
  await page.getByRole('button', { name: 'Свернуть заметки' }).click()
  await expect(page.getByRole('button', { name: 'Открыть заметки' })).toBeVisible()
  await page.getByRole('button', { name: 'Открыть заметки' }).click()
  await expect(page.getByRole('button', { name: 'Редактировать заметки' })).toBeVisible()
})
