import { expect, test } from '@playwright/test'
import { openApp, readVaultFile } from './helpers.ts'

test('drag a ticket to another column persists status and order', async ({ page }) => {
  const errors = await openApp(page)
  const card = page.locator('[data-ticket="TD-11"]')
  const target = page.locator('[data-ticket="TD-12"]')
  const a = (await card.boundingBox())!
  const b = (await target.boundingBox())!
  await page.mouse.move(a.x + 40, a.y + 20)
  await page.mouse.down()
  await page.mouse.move(a.x + 60, a.y + 30, { steps: 5 })
  await page.mouse.move(b.x + 60, b.y + b.height + 20, { steps: 15 })
  await page.mouse.up()

  await expect(page.locator('section[aria-label="In Progress"] [data-ticket]')).toHaveCount(2)
  await expect.poll(() => readVaultFile(page, 'tickets/TD-11.md')).toContain('status: in-progress')
  expect(errors).toEqual([])
})

test('create a ticket and edit it in the dialog', async ({ page }) => {
  const errors = await openApp(page)
  await page.getByRole('button', { name: 'New ticket' }).click()
  await page.getByLabel('Title').fill('ทดสอบสร้าง ticket')
  await page.getByRole('button', { name: 'Create ticket' }).click()

  await expect(page.getByLabel('Ticket title')).toHaveValue('ทดสอบสร้าง ticket')
  await page.getByRole('combobox').nth(1).click()
  await page.getByRole('option', { name: 'Urgent' }).click()
  await page.locator('.cm-content').click()
  await page.keyboard.type('Steps:\n- [ ] one', { delay: 5 })

  await expect.poll(() => readVaultFile(page, 'tickets/TD-13.md')).toContain('priority: urgent')
  await expect.poll(() => readVaultFile(page, 'tickets/TD-13.md')).toContain('- [ ] one')
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-ticket="TD-13"]')).toBeVisible()
  expect(errors).toEqual([])
})

test('filters narrow the board', async ({ page }) => {
  await openApp(page)
  await page.getByPlaceholder('Filter tickets…').fill('งบประมาณ')
  await expect(page.locator('[data-ticket]')).toHaveCount(1)
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await page.getByRole('button', { name: /^Overdue · \d+$/ }).click()
  await expect(page.locator('[data-ticket]')).toHaveCount(1)
  await expect(page.locator('[data-ticket="TD-12"]')).toBeVisible()
})

test('ticket details panel collapses and stays collapsed', async ({ page }) => {
  await openApp(page, '/board?ticket=TD-12')
  const status = page.getByText('Details', { exact: true })
  await expect(status).toBeVisible()

  await page.getByRole('button', { name: 'Hide details' }).click()
  await expect(status).toBeHidden()
  // Compact summary keeps key fields visible and reopens the panel.
  await expect(page.getByTitle('Show details').last()).toContainText('In Progress')

  await page.keyboard.press('Escape')
  await page.locator('[data-ticket="TD-11"]').click()
  await expect(page.getByText('Details', { exact: true })).toBeHidden()
  await page.getByRole('button', { name: 'Show details' }).click()
  await expect(page.getByText('Details', { exact: true })).toBeVisible()
})
