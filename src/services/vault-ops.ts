import { buildIndexedFile, classify } from '@/index/indexer'
import { basename, dirname, extname, isInside, joinPath, stem } from '@/vault/paths'
import { VaultFsError, type FileStat } from '@/vault/vault-fs'
import { useVault } from '@/vault/vault-store'
import { ConflictError, ReadOnlyError } from './errors'

export const TRASH_DIR = '.trash'

function writable() {
  const s = useVault.getState()
  if (s.status !== 'ready' || !s.fs || !s.config) throw new ReadOnlyError()
  return { fs: guarded(s.fs), config: s.config, commit: s.commit }
}

/**
 * Wrap fs calls so a revoked permission (e.g. Edge dropped access mid-session) flips the vault to
 * `locked` and the UI offers Reconnect instead of failing silently.
 */
function guarded<T extends object>(fs: T): T {
  return new Proxy(fs, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver)
      // Async generators (walk/walkDirs) must stay iterable, so only wrap promise-returning methods.
      if (typeof value !== 'function' || key === 'walk' || key === 'walkDirs') return value
      return async (...args: unknown[]) => {
        try {
          return await value.apply(target, args)
        } catch (e) {
          if (e instanceof VaultFsError && e.code === 'permission') useVault.getState().lock()
          throw e
        }
      }
    },
  })
}

function isMarkdown(path: string) {
  const kind = classify(path)
  return kind === 'note' || kind === 'ticket'
}

export async function readFile(path: string): Promise<{ text: string; mtime: number }> {
  const { fs } = useVault.getState()
  if (!fs) throw new ReadOnlyError()
  const stat = await fs.stat(path)
  if (!stat) throw new Error(`File not found: ${path}`)
  return { text: await fs.readText(path), mtime: stat.mtime }
}

/**
 * Write a text file and update the index. With `expectedMtime`, refuses to overwrite a file that
 * changed on disk since it was read (e.g. edited in Obsidian or Notepad).
 */
export async function writeFile(path: string, text: string, opts: { expectedMtime?: number } = {}): Promise<FileStat> {
  const { fs, commit } = writable()
  if (opts.expectedMtime !== undefined) {
    const current = await fs.stat(path)
    if (current && current.mtime !== opts.expectedMtime) throw new ConflictError(path)
  }
  const stat = await fs.writeText(path, text)
  await commit({ upserts: [{ stat, text: isMarkdown(path) ? text : null }], dirsAdded: [dirname(path)].filter(Boolean) })
  return stat
}

export async function writeBinary(path: string, data: Blob): Promise<FileStat> {
  const { fs, commit } = writable()
  const stat = await fs.writeBlob(path, data)
  await commit({ upserts: [{ stat, text: null }], dirsAdded: [dirname(path)].filter(Boolean) })
  return stat
}

/** `notes/a.md` → `notes/a 1.md` → `notes/a 2.md` … until free. Works for folders too. */
export async function uniquePath(path: string): Promise<string> {
  const { fs, files, dirs } = useVault.getState()
  const taken = async (p: string) => files.has(p) || dirs.has(p) || (fs ? (await fs.stat(p)) !== null : false)
  if (!(await taken(path))) return path
  const dir = dirname(path)
  const ext = extname(path)
  const base = ext ? stem(path) : basename(path)
  for (let i = 1; ; i++) {
    const candidate = joinPath(dir, `${base} ${i}${ext}`)
    if (!(await taken(candidate))) return candidate
  }
}

export async function createFolder(path: string): Promise<string> {
  const { fs, commit } = writable()
  const target = await uniquePath(path)
  await fs.mkdir(target)
  await commit({ dirsAdded: [target] })
  return target
}

/**
 * Move a file or folder. Returns [from, to] pairs for every file moved.
 * Folders are moved file-by-file because directory handles cannot be moved on all Chromium builds.
 */
export async function movePath(from: string, to: string): Promise<[string, string][]> {
  const { fs, commit } = writable()
  const { files, dirs } = useVault.getState()
  if (from === to) return []
  if (isInside(to, from)) throw new Error('Cannot move a folder into itself')

  if (!dirs.has(from)) {
    const stat = await fs.move(from, to)
    const text = isMarkdown(to) ? await fs.readText(to) : null
    await commit({ removed: [from], upserts: [{ stat, text }], dirsAdded: [dirname(to)].filter(Boolean) })
    return [[from, to]]
  }

  const pairs: [string, string][] = []
  const upserts: { stat: FileStat; text: string | null }[] = []
  await fs.mkdir(to)
  for (const path of [...files.keys()].filter((p) => isInside(p, from))) {
    const dest = to + path.slice(from.length)
    const stat = await fs.move(path, dest)
    upserts.push({ stat, text: isMarkdown(dest) ? await fs.readText(dest) : null })
    pairs.push([path, dest])
  }
  const movedDirs = [...dirs].filter((d) => isInside(d, from)).map((d) => to + d.slice(from.length))
  for (const d of movedDirs) await fs.mkdir(d)
  await fs.remove(from)
  await commit({ removed: pairs.map(([p]) => p), upserts, dirsRemoved: [from], dirsAdded: [to, ...movedDirs] })
  return pairs
}

/** Soft delete: move into `.trash/` keeping the relative path. Never hard-deletes user data. */
export async function trashPath(path: string): Promise<void> {
  const { fs } = writable()
  const dest = await uniquePath(joinPath(TRASH_DIR, path))
  await fs.mkdir(dirname(dest))
  await movePath(path, dest)
}

/** Build an IndexedFile for text that is not written yet (used for optimistic previews/tests). */
export function previewIndexedFile(path: string, text: string) {
  const { config } = useVault.getState()
  return buildIndexedFile(config?.vaultId ?? 'preview', { path, size: text.length, mtime: Date.now() }, text)
}
