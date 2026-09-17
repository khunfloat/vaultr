import { expect, type Page } from '@playwright/test'

export async function openApp(page: Page, hash = '/board') {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto(`/?fs=memory#${hash}`)
  await expect(page.getByText('FixtureVault')).toBeVisible()
  return errors
}

export function readVaultFile(page: Page, path: string) {
  return page.evaluate((p) => (window as unknown as { __vault: { getState(): { fs: { readText(p: string): Promise<string> } } } }).__vault.getState().fs.readText(p), path)
}
