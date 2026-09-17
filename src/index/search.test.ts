import { buildIndexedFile } from './indexer'
import { buildSearchIndex, plainText } from './search'

const file = (path: string, text: string) => buildIndexedFile('v', { path, size: text.length, mtime: 1 }, text)

describe('search', () => {
  const idx = buildSearchIndex([
    file('notes/Login flow.md', '---\ntags: [sso]\n---\nToken exchange must finish within timeout #incident'),
    file('notes/ประชุม.md', 'คุยเรื่องงบประมาณไตรมาสสี่'),
    file('tickets/TD-1.md', '---\nkey: TD-1\ntitle: Fix callback\n---\nbody'),
    file('attachments/x.png', ''),
  ])

  it('ranks title matches and supports prefixes', () => {
    expect(idx.search('login')[0].path).toBe('notes/Login flow.md')
    expect(idx.search('exch')[0].snippet?.match.toLowerCase()).toBe('exch')
  })

  it('finds Thai substrings', () => {
    expect(idx.search('งบประมาณ').map((h) => h.path)).toEqual(['notes/ประชุม.md'])
  })

  it('filters by tag, alone or with text', () => {
    expect(idx.search('#sso').map((h) => h.path)).toEqual(['notes/Login flow.md'])
    expect(idx.search('#incident token').map((h) => h.path)).toEqual(['notes/Login flow.md'])
    expect(idx.search('#sso callback')).toEqual([])
  })

  it('finds tickets by key', () => {
    expect(idx.search('TD-1')[0].path).toBe('tickets/TD-1.md')
  })

  it('snippets hide markdown syntax', () => {
    expect(plainText('- [x] Raise **timeout** in [[Login flow|flow]] > see [docs](https://x.y)\n> [!note] Hi')).toBe('Raise timeout in flow > see docs\nHi')
    const hit = buildSearchIndex([file('notes/a.md', '## Plan\n- [ ] Bump the ==timeout== for [[Login flow]]')]).search('timeout')[0]
    expect(`${hit.snippet?.before}${hit.snippet?.match}${hit.snippet?.after}`).toBe('Plan\nBump the timeout for Login flow'.replace(/\s+/g, ' '))
  })
})
