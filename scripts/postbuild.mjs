// Rename the single-file build to vaultr.html and fail if anything would load from outside the file.
import { readFileSync, renameSync, readdirSync } from 'node:fs'

const dist = new URL('../dist/', import.meta.url)
const files = readdirSync(dist)
const extra = files.filter((f) => f !== 'index.html' && f !== 'vaultr.html')
if (extra.length) fail(`dist must contain a single html file, found extra: ${extra.join(', ')}`)

renameSync(new URL('index.html', dist), new URL('vaultr.html', dist))
const html = readFileSync(new URL('vaultr.html', dist), 'utf8')

const external = [
  /<script[^>]+\bsrc=/i,
  /<link[^>]+\bhref=["'](?!data:)[^"']+["'][^>]*>/i,
  /@import\s+url\(\s*["']?https?:/i,
  /url\(\s*["']?https?:\/\/(?!www\.w3\.org)/i,
]
for (const re of external) {
  const m = html.match(re)
  if (m) fail(`external resource reference found: ${m[0].slice(0, 120)}`)
}

// Favicon must stay an inline SVG data URI; an unescaped `#` silently truncates it.
const icon = html.match(/<link rel="icon"[^>]*href="(data:image\/svg\+xml,[^"]*)"/)
if (!icon) fail('favicon <link rel="icon"> with an inline SVG data URI is missing')
if (icon[1].includes('#')) fail('favicon data URI contains a raw "#" — encode it as %23')

console.log(`✓ dist/vaultr.html ${(html.length / 1024).toFixed(0)} KB, self-contained`)

function fail(msg) {
  console.error(`✗ ${msg}`)
  process.exit(1)
}
