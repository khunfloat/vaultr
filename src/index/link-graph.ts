import type { WikiLink } from '@/markdown/extract'
import { createResolver, type LinkResolver } from '@/markdown/resolve'
import type { IndexedFile } from './types'

export interface LinkRef {
  from: string
  link: WikiLink
  /** The source line, for backlink previews. */
  context: string
}

export interface LinkGraph {
  resolver: LinkResolver
  backlinks(path: string): LinkRef[]
  outgoing(path: string): { link: WikiLink; resolved: string | null }[]
}

export function buildLinkGraph(files: ReadonlyMap<string, IndexedFile>): LinkGraph {
  const resolver = createResolver(files.values())
  const incoming = new Map<string, LinkRef[]>()
  const outgoingByPath = new Map<string, { link: WikiLink; resolved: string | null }[]>()

  for (const file of files.values()) {
    if (!file.links.length) continue
    const lines = file.body.split(/\r?\n/)
    const out = file.links.map((link) => {
      const resolved = resolver.resolve(link.target, file.path)
      if (resolved && resolved !== file.path) {
        const refs = incoming.get(resolved) ?? []
        refs.push({ from: file.path, link, context: (lines[link.line] ?? '').trim() })
        incoming.set(resolved, refs)
      }
      return { link, resolved }
    })
    outgoingByPath.set(file.path, out)
  }

  return {
    resolver,
    backlinks: (path) => incoming.get(path) ?? [],
    outgoing: (path) => outgoingByPath.get(path) ?? [],
  }
}
