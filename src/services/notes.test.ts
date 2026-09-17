import { MemoryFs } from '@/vault/memory-fs'
import { useVault } from '@/vault/vault-store'
import { createNote, moveAndRelink, renameNote } from './notes'

async function setup(files: Record<string, string> = {}) {
  const fs = new MemoryFs({ files })
  vi.stubGlobal('window', { setInterval: () => 0, clearInterval: () => {}, addEventListener: () => {}, removeEventListener: () => {} })
  vi.stubGlobal('document', { visibilityState: 'hidden', addEventListener: () => {}, removeEventListener: () => {} })
  await useVault.getState().attach(fs)
  return fs
}

describe('notes service', () => {
  it('creates untitled notes with unique names', async () => {
    await setup()
    expect(await createNote()).toBe('notes/Untitled.md')
    expect(await createNote()).toBe('notes/Untitled 1.md')
  })

  it('renames a note and rewrites links, keeping heading and alias', async () => {
    const fs = await setup({
      'notes/Login flow.md': '# Login',
      'notes/other.md': 'See [[Login flow]], [[login flow#Seq|the flow]] and [[Unrelated]]',
      'tickets/TD-1.md': '---\nkey: TD-1\n---\n![[Login flow]]',
    })
    const result = await renameNote('notes/Login flow.md', 'SSO login')
    expect(result.path).toBe('notes/SSO login.md')
    expect(result.relinked).toBe(2)
    expect(await fs.readText('notes/other.md')).toBe('See [[SSO login]], [[SSO login#Seq|the flow]] and [[Unrelated]]')
    expect(await fs.readText('tickets/TD-1.md')).toContain('![[SSO login]]')
  })

  it('rejects renaming onto an existing note', async () => {
    await setup({ 'notes/a.md': '', 'notes/b.md': '' })
    await expect(renameNote('notes/a.md', 'b')).rejects.toThrow('already exists')
  })

  it('moves a folder and updates path-style links, including links inside the moved files', async () => {
    const fs = await setup({
      'notes/p/a.md': 'link to [[b]]',
      'notes/p/b.md': 'B',
      'notes/index.md': '[[notes/p/a]] and [[b]]',
    })
    await moveAndRelink('notes/p', 'notes/archive/p')
    expect(await fs.readText('notes/index.md')).toBe('[[notes/archive/p/a]] and [[b]]')
    expect(await fs.readText('notes/archive/p/a.md')).toBe('link to [[b]]')
  })
})
