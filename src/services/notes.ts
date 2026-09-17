import { classify } from '@/index/indexer'
import type { IndexedFile } from '@/index/types'
import { createResolver } from '@/markdown/resolve'
import { VAULT_DIRS } from '@/vault/config'
import { extname, joinPath } from '@/vault/paths'
import { useVault } from '@/vault/vault-store'
import { createFolder, movePath, readFile, trashPath, uniquePath, writeFile } from './vault-ops'

const WIKILINK = /(!?)\[\[([^[\]|#^\n]*)((?:[#^][^[\]|\n]*)?)((?:\|[^[\]\n]*)?)\]\]/g

export async function createNote(folder: string = VAULT_DIRS.notes, name = 'Untitled', body = ''): Promise<string> {
  const path = await uniquePath(joinPath(folder, `${name}.md`))
  await writeFile(path, body)
  return path
}

export { createFolder, trashPath }

/**
 * Rename or move a note/folder and rewrite `[[links]]` in other files that pointed at the moved files.
 * Returns the [from, to] pairs of moved files.
 */
export async function moveAndRelink(from: string, to: string): Promise<{ pairs: [string, string][]; relinked: number }> {
  const before = useVault.getState().files
  const oldResolver = createResolver(before.values())
  const pairs = await movePath(from, to)
  if (!pairs.length) return { pairs, relinked: 0 }

  const moved = new Map(pairs)
  const after = useVault.getState().files
  const newResolver = createResolver(after.values())
  let relinked = 0

  const candidates = [...after.values()].filter((f) => (f.kind === 'note' || f.kind === 'ticket') && f.links.length)
  for (const file of candidates) {
    const originalPath = [...moved].find(([, dest]) => dest === file.path)?.[0] ?? file.path
    const oldFile = before.get(originalPath)
    if (!oldFile?.links.some((l) => moved.has(oldResolver.resolve(l.target, originalPath) ?? ''))) continue

    const { text, mtime } = await readFile(file.path)
    const next = text.replace(WIKILINK, (whole, bang: string, target: string, sub: string, alias: string) => {
      const oldTarget = target.trim() ? oldResolver.resolve(target.trim(), originalPath) : null
      const newPath = oldTarget ? moved.get(oldTarget) : undefined
      if (!newPath) return whole
      const keepExt = extname(target.trim()) !== '' && extname(newPath) !== '.md'
      let label = target.includes('/') ? newPath : newResolver.linkText(newPath)
      if (extname(newPath) === '.md' && label.endsWith('.md') && !keepExt) label = label.slice(0, -3)
      return `${bang}[[${label}${sub}${alias}]]`
    })
    if (next !== text) {
      await writeFile(file.path, next, { expectedMtime: mtime })
      relinked++
    }
  }
  return { pairs, relinked }
}

/** Rename a note keeping its folder. `newName` is without extension. */
export async function renameNote(path: string, newName: string) {
  const clean = newName.trim().replace(/[\\/:*?"<>|]/g, '-')
  if (!clean) throw new Error('Name cannot be empty')
  const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''
  const ext = classify(path) === 'note' ? '.md' : extname(path)
  const target = joinPath(folder, `${clean}${ext}`)
  if (target === path) return { pairs: [] as [string, string][], relinked: 0, path }
  if (useVault.getState().files.has(target)) throw new Error(`"${clean}" already exists`)
  const result = await moveAndRelink(path, target)
  return { ...result, path: target }
}

export function notesInFolder(files: Iterable<IndexedFile>, folder: string) {
  return [...files].filter((f) => f.kind === 'note' && f.path.startsWith(folder + '/'))
}
