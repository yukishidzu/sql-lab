import { test as base } from '@playwright/test'

export const test = base.extend({
  page: async ({ page }, runFixture) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-lab-interface-guide-v1', 'seen')
    })
    await runFixture(page)
  },
})

export { expect } from '@playwright/test'
export type { Locator, Page } from '@playwright/test'
