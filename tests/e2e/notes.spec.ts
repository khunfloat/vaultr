import { expect, test } from '@playwright/test'
import { openApp, readVaultFile } from './helpers.ts'

const LOGIN = '/notes/Projects/SSO%20Migration/Login%20flow.md'

test('edit a note with wikilink autocomplete; saves to disk', async ({ page }) => {
  const errors = await openApp(page, LOGIN)
  await page.locator('.cm-content').click()
  await page.keyboard.press('Control+End')
  await page.keyboard.type('\n\nSee [[Call', { delay: 10 })
  await expect(page.locator('.cm-tooltip-autocomplete')).toContainText('Callback errors')
  // CodeMirror ignores Enter for 75ms after the list opens to avoid accidental picks.
  await page.waitForTimeout(150)
  await page.keyboard.press('Enter')
  await expect.poll(() => readVaultFile(page, 'notes/Projects/SSO Migration/Login flow.md')).toContain('See [[Callback errors]]')
  expect(errors).toEqual([])
})

test('rename a note updates links in other files', async ({ page }) => {
  await openApp(page, LOGIN)
  const title = page.getByLabel('Note title')
  await title.fill('SSO login flow')
  await title.press('Enter')
  await expect(page).toHaveURL(/SSO%20login%20flow\.md/)
  await expect.poll(() => readVaultFile(page, 'tickets/TD-12.md')).toContain('[[SSO login flow]]')
  await expect.poll(() => readVaultFile(page, 'notes/Meetings/2026-09-15 ประชุมทีม.md')).toContain('[[SSO login flow]]')
})

test('clicking wikilinks opens notes and tickets', async ({ page }) => {
  await openApp(page, '/notes/Projects/SSO%20Migration/Callback%20errors.md')
  await page.getByText('Login flow', { exact: false }).first().click()
  await expect(page.getByLabel('Note title')).toHaveValue('Login flow')
  await page.getByRole('radio', { name: 'Reading' }).click()
  await page.locator('.md-prose a.wikilink', { hasText: 'TD-12' }).click()
  await expect(page.getByLabel('Ticket title')).toHaveValue('Fix login timeout on SSO callback')
})

test('backlinks panel and search', async ({ page }) => {
  await openApp(page, LOGIN)
  await expect(page.getByText('Backlinks · 3')).toBeVisible()
  await page.keyboard.press('Control+Shift+F')
  await page.getByPlaceholder(/Search notes and tickets/).fill('งบประมาณ')
  await expect(page.getByText('เตรียมสไลด์งบประมาณ Q4')).toBeVisible()
})

test('create a note from the sidebar, then move it to trash', async ({ page }) => {
  await openApp(page, '/notes')
  await page.getByTitle('New note').click()
  await expect(page.getByLabel('Note title')).toHaveValue('Untitled')
  await page.getByRole('button', { name: 'Note actions' }).click()
  await page.getByRole('menuitem', { name: 'Move to trash' }).click()
  await expect.poll(() => readVaultFile(page, '.trash/notes/Untitled.md')).toBe('')
})

type VaultWindow = {
  __vault: { getState(): { fs: { externalWrite(p: string, t: string): void }; rescan(): Promise<void> } }
}

test('external edits reload a clean note and flag a conflict on a dirty one', async ({ page }) => {
  await openApp(page, '/notes/Inbox.md')
  await expect(page.locator('.cm-content')).toContainText('quick notes')

  await page.evaluate(async () => {
    const v = (window as unknown as VaultWindow).__vault.getState()
    v.fs.externalWrite('notes/Inbox.md', 'changed in Notepad')
    await v.rescan()
  })
  await expect(page.locator('.cm-content')).toContainText('changed in Notepad')

  await page.locator('.cm-content').click()
  await page.keyboard.type(' + my edit')
  await page.evaluate(async () => {
    const v = (window as unknown as VaultWindow).__vault.getState()
    v.fs.externalWrite('notes/Inbox.md', 'changed again elsewhere')
    await v.rescan()
  })
  await expect(page.getByText('This file changed on disk while you were editing.')).toBeVisible()
  await page.getByRole('button', { name: 'Keep my version' }).click()
  await expect.poll(() => readVaultFile(page, 'notes/Inbox.md')).toContain('+ my edit')
})

test('slash menu inserts blocks like Notion', async ({ page }) => {
  const errors = await openApp(page, '/notes/Inbox.md')
  await page.locator('.cm-content').click()
  await page.keyboard.press('Control+End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('/')
  const menu = page.locator('.cm-tooltip-autocomplete')
  await expect(menu).toContainText('Basic blocks')
  await expect(menu).toContainText('Code block')

  await page.keyboard.type('quo')
  await page.waitForTimeout(150)
  await page.keyboard.press('Enter')
  await page.keyboard.type('quoted text')

  // Enter continues the quote; Enter on the empty quote line leaves it.
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.keyboard.type('/code')
  await expect(page.locator('.cm-tooltip-autocomplete li[aria-selected]')).toContainText('Code block')
  await page.waitForTimeout(150)
  await page.keyboard.press('Enter')
  await page.keyboard.type('const x = 1')

  await expect.poll(() => readVaultFile(page, 'notes/Inbox.md')).toContain('> quoted text')
  await expect.poll(() => readVaultFile(page, 'notes/Inbox.md')).toContain('```\nconst x = 1\n```')
  expect(errors).toEqual([])
})

test('source mode looks like a code editor and copies the markdown', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await openApp(page, LOGIN)
  await page.getByRole('radio', { name: 'Source' }).click()

  await expect(page.locator('.cm-lineNumbers')).toBeVisible()
  await expect(page.getByText('Login flow.md', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Copy markdown' }).click()
  await expect(page.getByRole('button', { name: 'Copy markdown' })).toContainText('Copied')

  const clip = await page.evaluate(() => navigator.clipboard.readText())
  expect(clip).toContain('# Login flow')
  expect(clip).toContain('[[TD-12]]')

  await page.getByRole('radio', { name: 'Live' }).click()
  await expect(page.locator('.cm-lineNumbers')).toHaveCount(0)
})

test('new notes go into the folder you are working in', async ({ page }) => {
  await openApp(page, LOGIN)
  await expect(page.getByTitle('New note in Projects/SSO Migration')).toBeVisible()
  await page.getByTitle('New note in Projects/SSO Migration').click()
  await expect.poll(() => readVaultFile(page, 'notes/Projects/SSO Migration/Untitled.md')).toBe('')

  // Clicking a folder in the tree makes it the target.
  await page.getByRole('treeitem', { name: 'Meetings' }).click()
  await expect(page.getByTitle('New note in Meetings')).toBeVisible()
})

test('move a note with "Move to…" and by dragging, links stay valid', async ({ page }) => {
  await openApp(page, '/notes/Inbox.md')
  await page.getByRole('button', { name: 'Note actions' }).click()
  await page.getByRole('menuitem', { name: 'Move to…' }).click()
  await page.getByPlaceholder('Type a folder name…').fill('sso')
  await page.getByRole('option', { name: 'Projects/SSO Migration' }).click()
  await expect(page).toHaveURL(/Projects\/SSO%20Migration\/Inbox\.md/)
  await expect.poll(() => readVaultFile(page, 'notes/Projects/SSO Migration/Inbox.md')).toContain('quick notes')

  // Drag the meeting note onto the Projects folder; the note linking to Login flow keeps working.
  await page.getByRole('treeitem', { name: 'Meetings' }).click()
  await page.getByRole('treeitem', { name: '2026-09-15 ประชุมทีม' }).dragTo(page.getByRole('treeitem', { name: 'Projects' }))
  await expect.poll(() => readVaultFile(page, 'notes/Projects/2026-09-15 ประชุมทีม.md')).toContain('[[Login flow]]')
})

test('web links: /link, paste, Space turns into a chip that opens a new tab', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const errors = await openApp(page, '/notes/Inbox.md')
  await page.locator('.cm-content').click()
  await page.keyboard.press('Control+End')
  await page.keyboard.press('Enter')

  await page.keyboard.type('/link')
  await expect(page.locator('.cm-link-hint')).toHaveText('Paste a link, then press Space')
  await page.evaluate(() => navigator.clipboard.writeText('example.com/docs/getting-started'))
  await page.keyboard.press('ControlOrMeta+V')
  await expect(page.locator('.cm-line').filter({ hasText: '/link' })).toHaveText('/link example.com/docs/getting-started')
  await page.keyboard.press('Space')
  await page.keyboard.type('is the guide')
  await expect.poll(() => readVaultFile(page, 'notes/Inbox.md')).toContain('[example.com/docs/getting-started](https://example.com/docs/getting-started) is the guide')

  // Picking "Link" from the menu leaves "/link " ready for the paste; Enter also converts.
  await page.keyboard.press('Enter')
  await page.keyboard.type('/lin')
  await expect(page.locator('.cm-tooltip-autocomplete li[aria-selected]')).toContainText('Link')
  await page.waitForTimeout(150)
  await page.keyboard.press('Enter')
  await page.keyboard.type('https://www.example.org/a/b')
  await page.keyboard.press('Enter')
  await expect.poll(() => readVaultFile(page, 'notes/Inbox.md')).toContain('[example.org/a/b](https://www.example.org/a/b)\n')

  await expect(page.locator('.cm-lp-chip', { hasText: 'example.com/docs/getting-started' })).toBeVisible()
  const popup = context.waitForEvent('page')
  await page.locator('.cm-lp-chip', { hasText: 'example.org/a/b' }).click()
  expect((await popup).url()).toContain('example.org/a/b')

  await page.getByRole('radio', { name: 'Reading' }).click()
  await expect(page.locator('.md-prose a.md-link-chip', { hasText: 'example.com/docs/getting-started' })).toHaveAttribute('target', '_blank')
  expect(errors.filter((e) => !e.includes('net::'))).toEqual([])
})
