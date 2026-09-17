// Regenerate README screenshots from the demo vault: `pnpm screenshots` (needs Microsoft Edge installed).
import { mkdirSync, readFileSync } from 'node:fs'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'

const OUT = new URL('../docs/images/', import.meta.url).pathname
const PORT = 5175
const BASE = `http://localhost:${PORT}/?fs=demo#`
mkdirSync(OUT, { recursive: true })

const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' })
await server.listen()
const browser = await chromium.launch({ channel: 'msedge' })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
await context.grantPermissions(['clipboard-read', 'clipboard-write'])
await context.addInitScript(() => {
  localStorage.setItem(
    'vaultr:notes-ui',
    JSON.stringify({
      version: 0,
      state: { tabs: [], mode: 'live', rightPanel: 'links', rightPanelOpen: true, expanded: ['notes/Projects', 'notes/Projects/SSO Migration', 'notes/Meetings'], currentFolder: 'notes' },
    }),
  )
})

async function open(hash, { wait = 900 } = {}) {
  const page = await context.newPage()
  await page.goto(BASE + hash)
  await page.getByText('Team Vault').first().waitFor()
  await page.addStyleTag({ content: '*{caret-color:transparent!important} .cm-cursor{display:none!important}' })
  await page.waitForTimeout(wait)
  return page
}
const shot = (page, name, clip) => page.screenshot({ path: `${OUT}${name}.png`, clip })
const done = (name) => console.log(`✓ ${name}.png`)

{
  const page = await open('/board')
  await shot(page, 'board'); done('board')

  await page.locator('[data-ticket="VR-12"]').click()
  await page.getByLabel('Ticket title').waitFor()
  await page.waitForTimeout(700)
  await shot(page, 'ticket'); done('ticket')
  await page.close()
}

{
  const page = await open('/notes/Projects/SSO%20Migration/Login%20flow.md', { wait: 1200 })
  await shot(page, 'notes'); done('notes')

  await page.getByRole('radio', { name: 'Source' }).click()
  await page.waitForTimeout(500)
  await shot(page, 'source-mode'); done('source-mode')
  await page.getByRole('radio', { name: 'Live' }).click()
  await page.close()
}

{
  const page = await open('/notes/Projects/SSO%20Migration/Incident%202026-09%20SSO.md', { wait: 1000 })
  await page.getByRole('radio', { name: 'Reading' }).click()
  await page.getByRole('tab', { name: 'Outline' }).click()
  await page.waitForTimeout(500)
  await shot(page, 'reading-mode'); done('reading-mode')
  await page.getByRole('radio', { name: 'Live' }).click()
  await page.close()
}

{
  const page = await open('/notes/Inbox.md', { wait: 1000 })
  await page.locator('.cm-line').last().click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1200)
  await page.keyboard.type('/')
  await page.waitForTimeout(500)
  await shot(page, 'slash-menu'); done('slash-menu')

  await page.keyboard.press('Escape')
  await page.keyboard.press('Backspace')
  await page.keyboard.type('Blocked on [[Log')
  await page.waitForTimeout(1200)
  await page.keyboard.press('Backspace')
  await page.keyboard.type('g')
  await page.waitForTimeout(300)
  await shot(page, 'wikilink-autocomplete'); done('wikilink-autocomplete')
  await page.keyboard.press('Escape')
  await page.close()
}

{
  const page = await open('/board')
  await page.keyboard.press('Control+o')
  await page.keyboard.type('sso')
  await page.waitForTimeout(500)
  await shot(page, 'quick-open'); done('quick-open')
  await page.close()
}

{
  const page = await open('/search?q=timeout')
  await page.waitForTimeout(500)
  await shot(page, 'search'); done('search')
  await page.close()
}

{
  const page = await context.newPage()
  await page.goto(`http://localhost:${PORT}/#/board`)
  await page.getByText('Open a vault').waitFor()
  await page.waitForTimeout(400)
  await shot(page, 'open-vault'); done('open-vault')
  await page.close()
}

// Hero banner: logo + tagline over the board screenshot.
{
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  const logo = await (await context.newPage()).goto(`http://localhost:${PORT}/`).then(async (r) => {
    const html = await r.text()
    return html.match(/<link rel="icon"[^>]*href="([^"]+)"/)[1].replace(/&amp;/g, '&')
  })
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#0a0a0a;font-family:'Segoe UI',system-ui,sans-serif;color:#fafafa;overflow:hidden">
  <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% -10%,rgba(96,165,250,.22),transparent 55%),radial-gradient(ellipse at 90% 110%,rgba(167,139,250,.18),transparent 50%)"></div>
  <div style="position:relative;display:flex;flex-direction:column;align-items:center;padding-top:64px">
    <div style="display:flex;align-items:center;gap:18px"><img src="${logo}" width="72" height="72"><span style="font-size:64px;font-weight:700;letter-spacing:-.03em">Vaultr</span></div>
    <p style="margin:18px 0 0;font-size:24px;color:#a1a1aa">Kanban tickets and Obsidian-style notes in a single HTML file.</p>
    <p style="margin:8px 0 0;font-size:18px;color:#71717a">No install · Works offline · Your data stays as Markdown in your own folder</p>
    <img src="data:image/png;base64,${readFileSync(`${OUT}board.png`).toString('base64')}" style="margin-top:48px;width:1200px;border-radius:14px;border:1px solid rgba(255,255,255,.12);box-shadow:0 40px 120px rgba(0,0,0,.7)">
  </div></body></html>`)
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}hero.png` })
  done('hero')
}

await browser.close()
await server.close()
