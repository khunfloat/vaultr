import { MemoryFs } from '@/vault/memory-fs'
import { useVault } from '@/vault/vault-store'
import { ConflictError } from './errors'
import { createFolder, movePath, readFile, trashPath, uniquePath, writeFile } from './vault-ops'

async function setup(files: Record<string, string> = {}) {
  const fs = new MemoryFs({ files })
  vi.stubGlobal('window', { setInterval: () => 0, clearInterval: () => {}, addEventListener: () => {}, removeEventListener: () => {} })
  vi.stubGlobal('document', { visibilityState: 'hidden', addEventListener: () => {}, removeEventListener: () => {} })
  await useVault.getState().attach(fs)
  return fs
}

describe('vault-ops', () => {
  it('writes and indexes immediately', async () => {
    await setup()
    await writeFile('notes/new/a.md', '# A\n[[B]]')
    const { files, dirs } = useVault.getState()
    expect(files.get('notes/new/a.md')?.links[0].target).toBe('B')
    expect(dirs.has('notes/new')).toBe(true)
  })

  it('detects conflicts with expectedMtime', async () => {
    const fs = await setup({ 'notes/a.md': 'one' })
    const { mtime } = await readFile('notes/a.md')
    fs.externalWrite('notes/a.md', 'changed elsewhere')
    await expect(writeFile('notes/a.md', 'mine', { expectedMtime: mtime })).rejects.toBeInstanceOf(ConflictError)
    expect(await fs.readText('notes/a.md')).toBe('changed elsewhere')
  })

  it('generates unique paths', async () => {
    await setup({ 'notes/a.md': '', 'notes/a 1.md': '' })
    expect(await uniquePath('notes/a.md')).toBe('notes/a 2.md')
    expect(await uniquePath('notes/b.md')).toBe('notes/b.md')
  })

  it('moves folders with their files and subfolders', async () => {
    await setup({ 'notes/p/a.md': 'A', 'notes/p/sub/b.md': 'B' })
    await createFolder('notes/p/empty')
    const pairs = await movePath('notes/p', 'notes/q')
    expect(pairs).toEqual([
      ['notes/p/a.md', 'notes/q/a.md'],
      ['notes/p/sub/b.md', 'notes/q/sub/b.md'],
    ])
    const { files, dirs } = useVault.getState()
    expect([...files.keys()].filter((p) => p.startsWith('notes/'))).toEqual(['notes/q/a.md', 'notes/q/sub/b.md'])
    expect(dirs.has('notes/p')).toBe(false)
    expect(dirs.has('notes/q/empty')).toBe(true)
  })

  it('trashes instead of deleting and hides trash from the index', async () => {
    const fs = await setup({ 'notes/a.md': 'keep me' })
    await trashPath('notes/a.md')
    expect(useVault.getState().files.has('notes/a.md')).toBe(false)
    expect([...useVault.getState().files.keys()].some((p) => p.startsWith('.trash'))).toBe(false)
    expect(await fs.readText('.trash/notes/a.md')).toBe('keep me')
  })
})

describe('permission loss', () => {
  it('locks the vault when a write is denied', async () => {
    const fs = await setup({ 'notes/a.md': 'x' })
    const { VaultFsError } = await import('@/vault/vault-fs')
    vi.spyOn(fs, 'writeText').mockRejectedValueOnce(new VaultFsError('denied', 'permission'))
    await expect(writeFile('notes/a.md', 'y')).rejects.toMatchObject({ code: 'permission' })
    expect(useVault.getState().status).toBe('locked')
  })
})
