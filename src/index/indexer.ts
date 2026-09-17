import { extractFacts, frontmatterTags } from '@/markdown/extract'
import { parseMarkdown } from '@/markdown/frontmatter'
import { VAULT_DIRS } from '@/vault/config'
import { extname, isInside, stem } from '@/vault/paths'
import type { FileStat, VaultFs } from '@/vault/vault-fs'
import type { FileKind, IndexedFile } from './types'

export function classify(path: string): FileKind {
  if (isInside(path, VAULT_DIRS.app)) return 'other'
  if (isInside(path, VAULT_DIRS.attachments)) return 'attachment'
  if (extname(path) !== '.md') return 'other'
  return isInside(path, VAULT_DIRS.tickets) ? 'ticket' : 'note'
}

export function buildIndexedFile(vaultId: string, stat: FileStat, text: string | null): IndexedFile {
  const kind = classify(stat.path)
  const base: IndexedFile = {
    vaultId,
    path: stat.path,
    kind,
    mtime: stat.mtime,
    size: stat.size,
    title: stem(stat.path),
    frontmatter: {},
    frontmatterError: null,
    body: '',
    links: [],
    tags: [],
    headings: [],
    tasks: { done: 0, total: 0 },
  }
  if (text === null) return base

  const parsed = parseMarkdown(text)
  const facts = extractFacts(parsed.body)
  const fmTitle = typeof parsed.data.title === 'string' ? parsed.data.title.trim() : ''
  const h1 = facts.headings.find((h) => h.level === 1)?.text
  return {
    ...base,
    title: fmTitle || (kind === 'note' ? stem(stat.path) : h1 || stem(stat.path)),
    frontmatter: parsed.data,
    frontmatterError: parsed.error,
    body: parsed.body,
    links: facts.links,
    tags: [...new Set([...frontmatterTags(parsed.data.tags), ...facts.tags])],
    headings: facts.headings,
    tasks: facts.tasks,
  }
}

export async function indexOne(fs: VaultFs, vaultId: string, stat: FileStat): Promise<IndexedFile> {
  const isMarkdown = classify(stat.path) === 'note' || classify(stat.path) === 'ticket'
  return buildIndexedFile(vaultId, stat, isMarkdown ? await fs.readText(stat.path) : null)
}

export interface IndexResult {
  files: Map<string, IndexedFile>
  /** Paths that are new or whose content changed since `previous`. */
  changed: string[]
  removed: string[]
}

/**
 * Scan the vault and return a fresh index. Files whose mtime and size match `previous`
 * are reused without reading, so rescans are cheap enough to run on a timer.
 */
export async function scanVault(
  fs: VaultFs,
  vaultId: string,
  previous: ReadonlyMap<string, IndexedFile>,
): Promise<IndexResult> {
  const files = new Map<string, IndexedFile>()
  const changed: string[] = []
  for await (const stat of fs.walk()) {
    const prev = previous.get(stat.path)
    if (prev && prev.vaultId === vaultId && prev.mtime === stat.mtime && prev.size === stat.size) {
      files.set(stat.path, prev)
      continue
    }
    try {
      files.set(stat.path, await indexOne(fs, vaultId, stat))
      changed.push(stat.path)
    } catch (e) {
      // File vanished between walk and read; the next scan will settle it.
      console.warn('index: skipped', stat.path, e)
    }
  }
  const removed = [...previous.keys()].filter((p) => !files.has(p))
  return { files, changed, removed }
}
