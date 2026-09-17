import MiniSearch from 'minisearch'
import type { IndexedFile } from './types'

export interface SearchHit {
  path: string
  score: number
  snippet: { before: string; match: string; after: string } | null
}

/** Thai has no spaces between words, so tokenize on whitespace/punctuation and match by prefix/substring. */
const tokenize = (text: string) => text.toLowerCase().split(/[\s\p{P}\p{S}]+/u).filter(Boolean)

export function buildSearchIndex(files: Iterable<IndexedFile>) {
  const docs = [...files].filter((f) => f.kind === 'note' || f.kind === 'ticket')
  const index = new MiniSearch<IndexedFile & { id: string; tagText: string; key: string }>({
    idField: 'id',
    fields: ['title', 'body', 'tagText', 'key'],
    storeFields: ['path'],
    tokenize,
    searchOptions: { prefix: true, fuzzy: 0.15, boost: { title: 3, key: 3, tagText: 2 }, combineWith: 'AND' },
  })
  index.addAll(docs.map((f) => ({ ...f, id: f.path, tagText: f.tags.join(' '), key: String(f.frontmatter.key ?? '') })))
  const byPath = new Map(docs.map((f) => [f.path, f]))

  return {
    search(query: string, limit = 100): SearchHit[] {
      const parts = query.trim().split(/\s+/).filter(Boolean)
      const tags = parts.filter((p) => p.startsWith('#') && p.length > 1).map((p) => p.slice(1).toLowerCase())
      const text = parts.filter((p) => !p.startsWith('#')).join(' ')
      const matchesTags = (f: IndexedFile) => tags.every((t) => f.tags.some((ft) => ft.toLowerCase() === t || ft.toLowerCase().startsWith(t + '/')))

      let hits: { path: string; score: number }[]
      if (text) {
        const ranked = index.search(text).map((r) => ({ path: r.id as string, score: r.score }))
        // Substring fallback catches Thai words inside longer runs of text.
        const seen = new Set(ranked.map((r) => r.path))
        const needle = text.toLowerCase()
        for (const f of docs) {
          if (seen.has(f.path)) continue
          if (f.title.toLowerCase().includes(needle) || f.body.toLowerCase().includes(needle)) ranked.push({ path: f.path, score: 0.5 })
        }
        hits = ranked
      } else if (tags.length) {
        hits = docs.map((f) => ({ path: f.path, score: 1 }))
      } else {
        return []
      }

      return hits
        .filter((h) => matchesTags(byPath.get(h.path)!))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((h) => ({ ...h, snippet: text ? snippet(byPath.get(h.path)!.body, text) : null }))
    },
  }
}

/** Strip markdown syntax so snippets read like prose. */
export function plainText(markdown: string): string {
  return markdown
    .replace(/^```.*$/gm, '')
    .replace(/!?\[\[([^\]|#^]*)(?:[#^][^\]|]*)?(?:\|([^\]]*))?\]\]/g, (_m, target: string, alias?: string) => alias ?? target)
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*>\s*\[![\w-]+\][+-]?\s*/gm, '')
    .replace(/^\s*(?:#{1,6}\s+|>\s?|[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+[.)]\s+)/gm, '')
    .replace(/(\*\*|__|==|~~|`)/g, '')
    .replace(/^\s*\|?\s*:?-{3,}.*$/gm, '')
    .replace(/\|/g, ' ')
}

function snippet(markdown: string, query: string) {
  const body = plainText(markdown)
  const lower = body.toLowerCase()
  const terms = [query.toLowerCase(), ...tokenize(query)].filter(Boolean)
  let at = -1
  let len = 0
  for (const t of terms) {
    at = lower.indexOf(t)
    if (at >= 0) {
      len = t.length
      break
    }
  }
  if (at < 0) return null
  const start = Math.max(0, at - 60)
  const end = Math.min(body.length, at + len + 80)
  const clean = (s: string) => s.replace(/\s+/g, ' ')
  return {
    before: (start > 0 ? '…' : '') + clean(body.slice(start, at)),
    match: body.slice(at, at + len),
    after: clean(body.slice(at + len, end)) + (end < body.length ? '…' : ''),
  }
}
