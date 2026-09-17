import type { IndexedFile } from '@/index/types'
import { dirname, extname, stem } from '@/vault/paths'

export interface LinkResolver {
  /** Resolve a wikilink target to a vault path, Obsidian-style. */
  resolve(target: string, fromPath?: string): string | null
  /** Shortest unambiguous link text for a path: ticket key, bare note name, or folder path. */
  linkText(path: string): string
}

type Linkable = Pick<IndexedFile, 'path' | 'kind' | 'frontmatter'>

export function createResolver(files: Iterable<Linkable>): LinkResolver {
  const byPath = new Map<string, string>()
  const byStem = new Map<string, string[]>()
  const byKey = new Map<string, string>()
  const all: string[] = []

  for (const f of files) {
    const lower = f.path.toLowerCase()
    all.push(f.path)
    byPath.set(lower, f.path)
    if (extname(f.path) === '.md') byPath.set(lower.slice(0, -3), f.path)
    const s = stem(f.path).toLowerCase()
    byStem.set(s, [...(byStem.get(s) ?? []), f.path])
    if (f.kind === 'ticket') {
      const key = typeof f.frontmatter.key === 'string' ? f.frontmatter.key : stem(f.path)
      byKey.set(key.toLowerCase(), f.path)
    }
  }

  const pickClosest = (candidates: string[], fromPath?: string) => {
    if (candidates.length === 1) return candidates[0]
    const fromDir = fromPath ? dirname(fromPath) : null
    const sameDir = fromDir !== null ? candidates.find((c) => dirname(c) === fromDir) : undefined
    return sameDir ?? [...candidates].sort((a, b) => a.length - b.length || a.localeCompare(b))[0]
  }

  return {
    resolve(target, fromPath) {
      const t = target.trim().replace(/^\/+/, '').toLowerCase()
      if (!t) return null
      const exact = byPath.get(t)
      if (exact) return exact
      if (t.includes('/')) {
        const suffix = all.filter((p) => {
          const l = p.toLowerCase()
          return l.endsWith('/' + t) || l.endsWith('/' + t + '.md')
        })
        if (suffix.length) return pickClosest(suffix, fromPath)
        return null
      }
      const key = byKey.get(t)
      if (key) return key
      const stems = byStem.get(t.endsWith('.md') ? t.slice(0, -3) : t)
      return stems?.length ? pickClosest(stems, fromPath) : null
    },
    linkText(path) {
      for (const [key, p] of byKey) if (p === path) return key.toUpperCase()
      const s = stem(path)
      const dupes = byStem.get(s.toLowerCase()) ?? []
      if (dupes.length <= 1) return extname(path) === '.md' ? s : path
      return extname(path) === '.md' ? path.slice(0, -3) : path
    },
  }
}
