import Dexie, { type EntityTable, type Table } from 'dexie'
import type { IndexedFile } from './types'

/** The single vault the app is attached to. Handles are structured-cloneable, so IndexedDB can keep them. */
export interface VaultRecord {
  id: 'current'
  handle: FileSystemDirectoryHandle
  name: string
  vaultId: string | null
  openedAt: number
}

class AppDb extends Dexie {
  vaults!: EntityTable<VaultRecord, 'id'>
  files!: Table<IndexedFile, [string, string]>

  constructor() {
    super('vaultr')
    this.version(1).stores({
      vaults: 'id',
      files: '[vaultId+path], vaultId',
    })
  }
}

export const db = new AppDb()

/** Remove the IndexedDB database used before the rename. Its contents are only a cache and a folder handle. */
export function dropLegacyDatabase() {
  return Dexie.delete('todo-vault').catch(() => {})
}

export async function loadCachedIndex(vaultId: string): Promise<Map<string, IndexedFile>> {
  const rows = await db.files.where('vaultId').equals(vaultId).toArray()
  return new Map(rows.map((f) => [f.path, f]))
}

export async function saveIndexChanges(vaultId: string, files: ReadonlyMap<string, IndexedFile>, changed: string[], removed: string[]) {
  if (!changed.length && !removed.length) return
  await db.transaction('rw', db.files, async () => {
    if (removed.length) await db.files.bulkDelete(removed.map((p) => [vaultId, p] as [string, string]))
    if (changed.length) await db.files.bulkPut(changed.map((p) => files.get(p)!).filter(Boolean))
  })
}

/** Drop cached rows for any vault other than the current one. */
export async function pruneOtherVaults(vaultId: string) {
  await db.files.where('vaultId').notEqual(vaultId).delete()
}
