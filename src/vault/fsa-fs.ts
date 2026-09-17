import { basename, dirname, joinPath, normalizePath, splitPath } from './paths'
import { IGNORED_DIRS, VaultFsError, type DirEntry, type FileStat, type VaultFs } from './vault-fs'

/** VaultFs backed by a File System Access API directory handle. */
export class FsaFs implements VaultFs {
  readonly root: FileSystemDirectoryHandle

  constructor(root: FileSystemDirectoryHandle) {
    this.root = root
  }

  get name() {
    return this.root.name
  }

  async list(dir: string): Promise<DirEntry[]> {
    const d = normalizePath(dir)
    const handle = await this.dir(d, false)
    const out: DirEntry[] = []
    for await (const [name, child] of handle.entries()) out.push({ path: joinPath(d, name), kind: child.kind })
    return out.sort((a, b) => a.path.localeCompare(b.path))
  }

  async *walk(): AsyncIterable<FileStat> {
    const stack: [string, FileSystemDirectoryHandle][] = [['', this.root]]
    while (stack.length) {
      const [path, handle] = stack.pop()!
      for await (const [name, child] of handle.entries()) {
        const childPath = joinPath(path, name)
        if (child.kind === 'directory') {
          if (!IGNORED_DIRS.has(name)) stack.push([childPath, child])
        } else {
          const file = await child.getFile()
          yield { path: childPath, size: file.size, mtime: file.lastModified }
        }
      }
    }
  }

  async *walkDirs(): AsyncIterable<string> {
    const stack: [string, FileSystemDirectoryHandle][] = [['', this.root]]
    while (stack.length) {
      const [path, handle] = stack.pop()!
      for await (const [name, child] of handle.entries()) {
        if (child.kind !== 'directory' || IGNORED_DIRS.has(name)) continue
        const childPath = joinPath(path, name)
        yield childPath
        stack.push([childPath, child])
      }
    }
  }

  async stat(path: string): Promise<FileStat | null> {
    try {
      const file = await (await this.file(path, false)).getFile()
      return { path: normalizePath(path), size: file.size, mtime: file.lastModified }
    } catch (e) {
      if (e instanceof VaultFsError && e.code === 'not-found') return null
      throw e
    }
  }

  async readText(path: string): Promise<string> {
    return (await this.readBlob(path)).text()
  }

  async readBlob(path: string): Promise<Blob> {
    return wrap(path, async () => (await this.file(path, false)).getFile())
  }

  writeText(path: string, text: string): Promise<FileStat> {
    return this.write(path, text)
  }

  writeBlob(path: string, data: Blob): Promise<FileStat> {
    return this.write(path, data)
  }

  async mkdir(path: string): Promise<void> {
    await this.dir(path, true)
  }

  async move(from: string, to: string): Promise<FileStat> {
    const src = normalizePath(from)
    const dst = normalizePath(to)
    if (await this.stat(dst)) throw new VaultFsError(`Destination exists: ${dst}`, 'exists')
    const handle = await this.file(src, false)
    const destDir = await this.dir(dirname(dst), true)
    if (typeof handle.move === 'function') {
      await wrap(src, () => handle.move!(destDir, basename(dst)))
    } else {
      await this.write(dst, await handle.getFile())
      await this.remove(src)
    }
    return (await this.stat(dst))!
  }

  async remove(path: string): Promise<void> {
    const p = normalizePath(path)
    if (!p) throw new VaultFsError('Cannot remove vault root', 'invalid')
    const parent = await this.dir(dirname(p), false)
    await wrap(p, () => parent.removeEntry(basename(p), { recursive: true }))
  }

  private async write(path: string, data: string | Blob): Promise<FileStat> {
    const handle = await this.file(path, true)
    // createWritable writes to a swap file and commits on close, so a failed write leaves the old content intact.
    await wrap(path, async () => {
      const stream = await handle.createWritable()
      try {
        await stream.write(data)
        await stream.close()
      } catch (e) {
        await stream.abort().catch(() => {})
        throw e
      }
    })
    const file = await handle.getFile()
    return { path: normalizePath(path), size: file.size, mtime: file.lastModified }
  }

  private async dir(path: string, create: boolean): Promise<FileSystemDirectoryHandle> {
    let handle = this.root
    for (const part of splitPath(path)) {
      handle = await wrap(path, () => handle.getDirectoryHandle(part, { create }))
    }
    return handle
  }

  private async file(path: string, create: boolean): Promise<FileSystemFileHandle> {
    const p = normalizePath(path)
    if (!p) throw new VaultFsError('Empty path', 'invalid')
    const parent = await this.dir(dirname(p), create)
    return wrap(p, () => parent.getFileHandle(basename(p), { create }))
  }
}

async function wrap<T>(path: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof VaultFsError) throw e
    const name = e instanceof DOMException ? e.name : ''
    if (name === 'NotFoundError') throw new VaultFsError(`Not found: ${path}`, 'not-found')
    if (name === 'NotAllowedError' || name === 'SecurityError') throw new VaultFsError(`Permission denied: ${path}`, 'permission')
    if (name === 'TypeMismatchError' || name === 'InvalidModificationError') throw new VaultFsError(`${name}: ${path}`, 'exists')
    throw new VaultFsError(`${name || 'Error'} at ${path}: ${e instanceof Error ? e.message : String(e)}`, 'io')
  }
}
