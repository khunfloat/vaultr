import { create } from 'zustand'
import { db, dropLegacyDatabase, loadCachedIndex, pruneOtherVaults, saveIndexChanges } from '@/index/db'
import { buildIndexedFile, scanVault } from '@/index/indexer'
import type { IndexedFile } from '@/index/types'
import { ensureVaultSkeleton, type VaultConfig } from './config'
import { FsaFs } from './fsa-fs'
import { hasReadWrite, isFsaSupported, pickVaultDirectory, requestReadWrite } from './permissions'
import { isInside, splitPath } from './paths'
import { IGNORED_DIRS, VaultFsError, type FileStat, type VaultFs } from './vault-fs'
import { startWatcher, type Watcher } from './watcher'

export type VaultStatus =
  | 'loading' // reading stored handle
  | 'unsupported' // browser has no File System Access API
  | 'no-vault' // nothing picked yet
  | 'locked' // handle stored, permission not granted this session; cached index shown read-only
  | 'connecting'
  | 'ready'
  | 'error'

interface VaultState {
  status: VaultStatus
  name: string | null
  fs: VaultFs | null
  config: VaultConfig | null
  files: ReadonlyMap<string, IndexedFile>
  /** Every directory in the vault, so empty folders still show in the tree. */
  dirs: ReadonlySet<string>
  error: string | null
  lastScanAt: number | null

  init(): Promise<void>
  openFolder(): Promise<void>
  reconnect(): Promise<void>
  closeVault(): Promise<void>
  rescan(): Promise<void>
  /** Attach an arbitrary VaultFs (memory mode, tests). */
  attach(fs: VaultFs): Promise<void>
  setConfig(config: VaultConfig): void
  /** Permission was lost: stop watching and show the Reconnect banner. */
  lock(): void
  /** Record changes the app itself made, so the index updates immediately without a rescan. */
  commit(change: IndexChange): Promise<void>
}

export interface IndexChange {
  upserts?: { stat: FileStat; text: string | null }[]
  removed?: string[]
  dirsAdded?: string[]
  dirsRemoved?: string[]
}

let watcher: Watcher | null = null

export const useVault = create<VaultState>()((set, get) => {
  async function connect(fs: VaultFs, handle: FileSystemDirectoryHandle | null) {
    watcher?.stop()
    set({ status: 'connecting', fs, name: fs.name, error: null })
    try {
      const config = await ensureVaultSkeleton(fs)
      if (handle) {
        await db.vaults.put({ id: 'current', handle, name: fs.name, vaultId: config.vaultId, openedAt: Date.now() })
        await pruneOtherVaults(config.vaultId)
      }
      const previous = handle ? await loadCachedIndex(config.vaultId) : new Map<string, IndexedFile>()
      set({ config, files: previous })
      await runScan(fs, config.vaultId, handle !== null)
      set({ status: 'ready' })
      watcher = startWatcher(() => get().rescan())
    } catch (e) {
      fail(e)
    }
  }

  async function runScan(fs: VaultFs, vaultId: string, persist: boolean) {
    const result = await scanVault(fs, vaultId, get().files)
    const dirs = new Set<string>()
    for await (const d of fs.walkDirs()) dirs.add(d)
    if (persist) await saveIndexChanges(vaultId, result.files, result.changed, result.removed)
    if (result.changed.length || result.removed.length || get().lastScanAt === null) set({ files: result.files })
    if (!sameSet(dirs, get().dirs)) set({ dirs })
    set({ lastScanAt: Date.now() })
  }

  function fail(e: unknown) {
    watcher?.stop()
    watcher = null
    if (e instanceof VaultFsError && e.code === 'permission') {
      set({ status: 'locked', error: null })
      return
    }
    console.error(e)
    set({ status: 'error', error: e instanceof Error ? e.message : String(e) })
  }

  return {
    status: 'loading',
    name: null,
    fs: null,
    config: null,
    files: new Map(),
    dirs: new Set(),
    error: null,
    lastScanAt: null,

    async init() {
      void dropLegacyDatabase()
      if (!isFsaSupported()) return set({ status: 'unsupported' })
      const record = await db.vaults.get('current')
      if (!record) return set({ status: 'no-vault' })
      if (await hasReadWrite(record.handle)) return connect(new FsaFs(record.handle), record.handle)
      const files = record.vaultId ? await loadCachedIndex(record.vaultId) : new Map()
      set({ status: 'locked', name: record.name, files })
    },

    async openFolder() {
      const handle = await pickVaultDirectory()
      if (handle) await connect(new FsaFs(handle), handle)
    },

    async reconnect() {
      const record = await db.vaults.get('current')
      if (!record) return set({ status: 'no-vault' })
      if (await requestReadWrite(record.handle)) await connect(new FsaFs(record.handle), record.handle)
    },

    async closeVault() {
      watcher?.stop()
      watcher = null
      await db.vaults.delete('current')
      set({ status: 'no-vault', fs: null, name: null, config: null, files: new Map(), dirs: new Set(), lastScanAt: null })
    },

    async rescan() {
      const { fs, config, status } = get()
      if (!fs || !config || status !== 'ready') return
      try {
        await runScan(fs, config.vaultId, fs instanceof FsaFs)
      } catch (e) {
        fail(e)
      }
    },

    attach(fs) {
      return connect(fs, null)
    },

    setConfig(config) {
      set({ config })
    },

    lock() {
      watcher?.stop()
      watcher = null
      set({ status: 'locked' })
    },

    async commit({ upserts = [], removed = [], dirsAdded = [], dirsRemoved = [] }) {
      const { config, fs } = get()
      if (!config) return
      const files = new Map(get().files)
      for (const p of removed) files.delete(p)
      const changed: string[] = []
      for (const { stat, text } of upserts) {
        if (isIgnored(stat.path)) continue
        files.set(stat.path, buildIndexedFile(config.vaultId, stat, text))
        changed.push(stat.path)
      }
      const dirs = new Set(get().dirs)
      for (const d of dirsRemoved) for (const x of [...dirs]) if (isInside(x, d)) dirs.delete(x)
      for (const d of dirsAdded) {
        if (isIgnored(d)) continue
        const parts = d.split('/')
        for (let i = 1; i <= parts.length; i++) dirs.add(parts.slice(0, i).join('/'))
      }
      set({ files, dirs })
      if (fs instanceof FsaFs) await saveIndexChanges(config.vaultId, files, changed, removed)
    },
  }
})

function isIgnored(path: string) {
  return splitPath(path).some((seg) => IGNORED_DIRS.has(seg))
}

function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>) {
  if (a.size !== b.size) return false
  for (const x of a) if (!b.has(x)) return false
  return true
}
