import { expect, test } from './fixtures'

test('ссылка открывает режим learn, а режим edit включается явно', async ({ page, context }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Интернет-магазин.*5 таблиц/s }).click()
  await expect(page.getByRole('button', { name: 'Выполнить', exact: true })).toBeVisible({ timeout: 90000 })
  await page.getByRole('button', { name: 'Поделиться сценарием' }).click()
  const sharedUrl = await page.getByRole('textbox', { name: 'Ссылка на сценарий' }).inputValue()

  const student = await context.newPage()
  await student.goto(sharedUrl)
  await expect(student.getByRole('button', { name: 'Выполнить', exact: true })).toBeVisible({ timeout: 90000 })
  await expect(student.getByRole('button', { name: 'Сценарий', exact: true })).toHaveCount(0)
  await expect(student.getByRole('button', { name: 'Редактировать заметки' })).toHaveCount(0)
  await student.getByRole('button', { name: 'Задания', exact: true }).click()
  await expect(student.getByRole('button', { name: 'Новое задание', exact: true })).toHaveCount(0)
  await expect(student.getByRole('button', { name: 'Проверить решение' })).toBeVisible()

  await student.evaluate(() => { location.hash += '?mode=edit' })
  await expect(student).toHaveURL(/mode=edit/)
  await expect(student.getByRole('button', { name: 'Сценарий', exact: true })).toBeVisible()
  await student.getByRole('button', { name: 'Задания', exact: true }).click()
  await expect(student.getByRole('button', { name: 'Новое задание', exact: true })).toBeVisible()

  await student.evaluate(() => { location.hash = location.hash.replace('mode=edit', 'mode=learn') })
  await expect(student.getByRole('button', { name: 'Сценарий', exact: true })).toHaveCount(0)
})
