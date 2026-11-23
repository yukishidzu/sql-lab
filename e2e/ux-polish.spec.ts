import { expect, test, type Locator, type Page } from '@playwright/test'

async function openAirline(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /Авиаперелёты.*7 таблиц/s }).click()
  await expect(page.getByRole('button', { name: 'Выполнить', exact: true })).toBeVisible({ timeout: 90000 })
}

async function dragBy(locator: Locator, x: number, y: number) {
  const box = await locator.boundingBox()
  if (!box) throw new Error('Нет разделителя')
  await locator.page().mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await locator.page().mouse.down()
  await locator.page().mouse.move(box.x + box.width / 2 + x, box.y + box.height / 2 + y, { steps: 8 })
  await locator.page().mouse.up()
}

test('главная сразу показывает сценарии без marketing hero', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Начать со сценария' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Мои рабочие пространства' })).toBeVisible()
  await expect(page.getByText('Схема перед глазами.')).toHaveCount(0)
  await expect(page.getByText('Для занятий и самостоятельной работы')).toHaveCount(0)
})

test('предпросмотр DDL скрыт, лейблы не обрезаются', async ({ page }) => {
  await openAirline(page)
  await page.getByRole('button', { name: 'Сценарий', exact: true }).click()
  await page.getByRole('button', { name: 'Новая таблица', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'DDL новой таблицы' })).toHaveCount(0)
  const scroll = await page.getByRole('region', { name: 'Колонка 1' }).boundingBox()
  const label = await page.getByText('Название', { exact: true }).first().boundingBox()
  const container = await page.locator('.overflow-auto.p-1.pt-2').boundingBox()
  expect((container?.y ?? 0) + 2).toBeLessThanOrEqual(label?.y ?? 0)
  expect((label?.y ?? 0) + (label?.height ?? 0)).toBeLessThanOrEqual((scroll?.y ?? 0) + (scroll?.height ?? 0))
  await page.getByRole('button', { name: 'Показать DDL' }).click()
  await expect(page.getByRole('textbox', { name: 'DDL новой таблицы' })).toBeVisible()
  await page.getByRole('button', { name: 'Скрыть DDL' }).click()
  await expect(page.getByRole('textbox', { name: 'DDL новой таблицы' })).toHaveCount(0)
})

test('SELECT идёт первым и autocomplete использует текстовые бейджи', async ({ page }) => {
  await openAirline(page)
  const editor = page.locator('.cm-content:visible')
  await editor.click()
  await editor.press('Control+A')
  await editor.pressSequentially('se')
  await expect(page.locator('.sql-completion').first()).toHaveText('SELECT')
  await expect(page.locator('.sql-completion-keyword').first()).toHaveClass(/sql-completion/)
  await expect(page.locator('.cm-tooltip-autocomplete svg')).toHaveCount(0)
})

test('drawer не сжимает SQL, список показывает PK/FK и короткие типы', async ({ page }) => {
  await openAirline(page)
  await expect(page.locator('path[data-cardinality]').first()).toBeVisible()
  await page.getByRole('button', { name: 'Показать список' }).click()
  await expect(page.getByRole('button', { name: 'Показать ERD' })).toBeVisible()
  await expect(page.locator('[data-id="flights"]')).toHaveCount(0)
  await expect(page.getByText('PK', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('FK', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('timestamp without time zone')).toHaveCount(0)
  await expect(page.getByText('timestamp', { exact: true }).first()).toBeVisible()
  await expect(page.locator('section[aria-label="ERD-схема базы данных"] > div').first().getByText('PostgreSQL')).toHaveCount(0)

  const before = await page.locator('.sql-editor').boundingBox()
  await page.getByRole('banner').getByRole('button', { name: 'Запросы', exact: true }).click()
  const after = await page.locator('.sql-editor').boundingBox()
  expect(after?.width).toBe(before?.width)
  await page.getByRole('button', { name: 'Маршруты рейсов', exact: true }).click()
  await expect(page.locator('[data-query-card]')).toHaveCount(0)
})

test('размеры сохраняются при скрытии, fitView не обрезает bookings после swap', async ({ page }) => {
  await openAirline(page)
  const schema = page.getByRole('region', { name: 'ERD-схема базы данных' })
  const initialSchema = await schema.boundingBox()
  await dragBy(page.locator('[role="separator"][aria-orientation="vertical"]'), -70, 0)
  const resizedSchema = await schema.boundingBox()
  expect(resizedSchema?.width).not.toBe(initialSchema?.width)
  await page.getByRole('button', { name: 'Скрыть схему' }).click()
  await page.getByRole('button', { name: 'Схема', exact: true }).click()
  const restoredSchema = await schema.boundingBox()
  expect(Math.abs((restoredSchema?.width ?? 0) - (resizedSchema?.width ?? 0))).toBeLessThan(3)

  const result = page.getByText('Результат', { exact: true }).locator('..').locator('..')
  const initialResult = await result.boundingBox()
  await dragBy(page.locator('[role="separator"][aria-orientation="horizontal"]'), 0, 70)
  const resizedResult = await result.boundingBox()
  expect(resizedResult?.height).not.toBe(initialResult?.height)
  await page.getByRole('button', { name: 'Скрыть результат' }).click()
  await page.getByRole('button', { name: 'Показать результат' }).click()
  const restoredResult = await result.boundingBox()
  expect(Math.abs((restoredResult?.height ?? 0) - (resizedResult?.height ?? 0))).toBeLessThan(3)

  await page.getByRole('button', { name: 'Поменять панели местами' }).click()
  await expect.poll(() => page.locator('[data-id="bookings"]').evaluate((element) => {
    const flow = document.querySelector('.react-flow')!.getBoundingClientRect()
    const rect = element.getBoundingClientRect()
    return rect.right <= flow.right + 2 && rect.left >= flow.left - 2
  })).toBe(true)
})
