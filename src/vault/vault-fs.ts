export interface FileStat {
  path: string
  size: number
  mtime: number
}

export interface DirEntry {
  path: string
  kind: 'file' | 'directory'
}

/**
 * Storage boundary for everything in the vault. Paths are vault-relative (see paths.ts).
 * Implementations: FsaFs (File System Access API) and MemoryFs (tests/dev).
 */
export interface VaultFs {
  readonly name: string
  /** Direct children of a directory. */
  list(dir: string): Promise<DirEntry[]>
  /** All files under the vault, recursively, skipping ignored directories. */
  walk(): AsyncIterable<FileStat>
  /** All directories under the vault (excluding the root and ignored directories). */
  walkDirs(): AsyncIterable<string>
  stat(path: string): Promise<FileStat | null>
  readText(path: string): Promise<string>
  readBlob(path: string): Promise<Blob>
  /** Creates parent directories as needed. */
  writeText(path: string, text: string): Promise<FileStat>
  writeBlob(path: string, data: Blob): Promise<FileStat>
  mkdir(path: string): Promise<void>
  /** Move or rename a file. Fails if the destination exists. */
  move(from: string, to: string): Promise<FileStat>
  remove(path: string): Promise<void>
}

/** Directories never indexed or watched. */
export const IGNORED_DIRS = new Set(['.git', '.obsidian', '.trash', 'node_modules'])

export type VaultFsErrorCode = 'not-found' | 'exists' | 'permission' | 'invalid' | 'io'

export class VaultFsError extends Error {
  readonly code: VaultFsErrorCode

  constructor(message: string, code: VaultFsErrorCode) {
    super(message)
    this.name = 'VaultFsError'
    this.code = code
  }
}
