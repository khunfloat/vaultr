import { dirname, isInside, normalizePath, splitPath } from './paths'
import { IGNORED_DIRS, VaultFsError, type DirEntry, type FileStat, type VaultFs } from './vault-fs'

interface MemFile {
  data: Uint8Array
  mtime: number
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

/** In-memory VaultFs for unit tests and the `?fs=memory` dev mode. */
export class MemoryFs implements VaultFs {
  readonly name: string
  private files = new Map<string, MemFile>()
  private dirs = new Set<string>([''])
  private clock: () => number

  constructor(options: { name?: string; files?: Record<string, string>; now?: () => number } = {}) {
    this.name = options.name ?? 'MemoryVault'
    let tick = 1_700_000_000_000
    this.clock = options.now ?? (() => (tick += 1000))
    for (const [path, text] of Object.entries(options.files ?? {})) this.put(path, encoder.encode(text))
  }

  async list(dir: string): Promise<DirEntry[]> {
    const d = normalizePath(dir)
    if (!this.dirs.has(d)) throw new VaultFsError(`Directory not found: ${d}`, 'not-found')
    const out: DirEntry[] = []
    for (const sub of this.dirs) if (sub && dirname(sub) === d) out.push({ path: sub, kind: 'directory' })
    for (const path of this.files.keys()) if (dirname(path) === d) out.push({ path, kind: 'file' })
    return out.sort((a, b) => a.path.localeCompare(b.path))
  }

  async *walk(): AsyncIterable<FileStat> {
    for (const [path, f] of [...this.files].sort(([a], [b]) => a.localeCompare(b))) {
      if (splitPath(path).slice(0, -1).some((seg) => IGNORED_DIRS.has(seg))) continue
      yield { path, size: f.data.byteLength, mtime: f.mtime }
    }
  }

  async *walkDirs(): AsyncIterable<string> {
    for (const d of [...this.dirs].sort()) {
      if (d && !splitPath(d).some((seg) => IGNORED_DIRS.has(seg))) yield d
    }
  }

  async stat(path: string): Promise<FileStat | null> {
    const p = normalizePath(path)
    const f = this.files.get(p)
    return f ? { path: p, size: f.data.byteLength, mtime: f.mtime } : null
  }

  async readText(path: string): Promise<string> {
    return decoder.decode(this.get(path).data)
  }

  async readBlob(path: string): Promise<Blob> {
    return new Blob([this.get(path).data.slice()])
  }

  async writeText(path: string, text: string): Promise<FileStat> {
    return this.put(path, encoder.encode(text))
  }

  async writeBlob(path: string, data: Blob): Promise<FileStat> {
    return this.put(path, new Uint8Array(await data.arrayBuffer()))
  }

  async mkdir(path: string): Promise<void> {
    const parts = splitPath(path)
    for (let i = 1; i <= parts.length; i++) {
      const d = parts.slice(0, i).join('/')
      if (this.files.has(d)) throw new VaultFsError(`A file exists at ${d}`, 'exists')
      this.dirs.add(d)
    }
  }

  async move(from: string, to: string): Promise<FileStat> {
    const src = normalizePath(from)
    const dst = normalizePath(to)
    const f = this.get(src)
    if (this.files.has(dst)) throw new VaultFsError(`Destination exists: ${dst}`, 'exists')
    await this.mkdir(dirname(dst))
    this.files.delete(src)
    this.files.set(dst, f)
    return { path: dst, size: f.data.byteLength, mtime: f.mtime }
  }

  async remove(path: string): Promise<void> {
    const p = normalizePath(path)
    if (this.files.delete(p)) return
    if (!p || !this.dirs.has(p)) throw new VaultFsError(`Not found: ${p}`, 'not-found')
    for (const d of [...this.dirs]) if (isInside(d, p)) this.dirs.delete(d)
    for (const f of [...this.files.keys()]) if (isInside(f, p)) this.files.delete(f)
  }

  /** Test helper: simulate an edit made outside the app (e.g. Notepad). */
  externalWrite(path: string, text: string): FileStat {
    return this.put(path, encoder.encode(text))
  }

  private get(path: string): MemFile {
    const f = this.files.get(normalizePath(path))
    if (!f) throw new VaultFsError(`File not found: ${path}`, 'not-found')
    return f
  }

  private put(path: string, data: Uint8Array): FileStat {
    const p = normalizePath(path)
    if (!p) throw new VaultFsError('Empty path', 'invalid')
    if (this.dirs.has(p)) throw new VaultFsError(`A directory exists at ${p}`, 'exists')
    const parts = splitPath(p)
    for (let i = 1; i < parts.length; i++) this.dirs.add(parts.slice(0, i).join('/'))
    const f = { data, mtime: this.clock() }
    this.files.set(p, f)
    return { path: p, size: data.byteLength, mtime: f.mtime }
  }
}
