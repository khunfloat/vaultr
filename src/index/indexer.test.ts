import { MemoryFs } from '@/vault/memory-fs'
import { classify, scanVault } from './indexer'
import type { IndexedFile } from './types'

const files = {
  'notes/Projects/Login flow.md': '---\ntags: [sso]\n---\n# Login flow\nSee [[TD-12]] #auth\n- [x] done',
  'tickets/TD-12.md': '---\nkey: TD-12\ntitle: Fix login\nstatus: todo\n---\nbody [[Login flow]]',
  'attachments/a.png': 'PNG',
  '.vaultr/config.json': '{}',
  'readme.txt': 'x',
}

describe('indexer', () => {
  it('classifies paths', () => {
    expect(classify('notes/a.md')).toBe('note')
    expect(classify('Inbox.md')).toBe('note')
    expect(classify('tickets/TD-1.md')).toBe('ticket')
    expect(classify('tickets/archive/TD-1.md')).toBe('ticket')
    expect(classify('attachments/x.md')).toBe('attachment')
    expect(classify('.vaultr/config.json')).toBe('other')
    expect(classify('notes/a.pdf')).toBe('other')
  })

  it('indexes markdown facts', async () => {
    const fs = new MemoryFs({ files })
    const { files: idx, changed } = await scanVault(fs, 'v1', new Map())
    expect(changed).toHaveLength(5)
    const note = idx.get('notes/Projects/Login flow.md')!
    expect(note).toMatchObject({ kind: 'note', title: 'Login flow', tags: ['sso', 'auth'], tasks: { done: 1, total: 1 } })
    expect(note.links.map((l) => l.target)).toEqual(['TD-12'])
    expect(idx.get('tickets/TD-12.md')).toMatchObject({ kind: 'ticket', title: 'Fix login', frontmatter: { status: 'todo' } })
    expect(idx.get('attachments/a.png')).toMatchObject({ kind: 'attachment', body: '' })
  })

  it('only re-reads changed files and reports removals', async () => {
    const fs = new MemoryFs({ files })
    const first = await scanVault(fs, 'v1', new Map())
    const readText = vi.spyOn(fs, 'readText')

    fs.externalWrite('tickets/TD-12.md', '---\nstatus: done\n---\n')
    await fs.remove('readme.txt')
    const second = await scanVault(fs, 'v1', first.files)

    expect(second.changed).toEqual(['tickets/TD-12.md'])
    expect(second.removed).toEqual(['readme.txt'])
    expect(readText).toHaveBeenCalledTimes(1)
    expect(second.files.get('notes/Projects/Login flow.md')).toBe(first.files.get('notes/Projects/Login flow.md'))
  })

  it('re-indexes everything when the vault id differs', async () => {
    const fs = new MemoryFs({ files })
    const first = await scanVault(fs, 'v1', new Map())
    const second = await scanVault(fs, 'v2', first.files as Map<string, IndexedFile>)
    expect(second.changed).toHaveLength(5)
  })
})
