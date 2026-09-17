import { MemoryFs } from './memory-fs'

describe('MemoryFs', () => {
  it('writes, reads and lists with implicit parent dirs', async () => {
    const fs = new MemoryFs()
    await fs.writeText('notes/a/b.md', 'ภาษาไทย')
    expect(await fs.readText('notes/a/b.md')).toBe('ภาษาไทย')
    expect(await fs.list('notes')).toEqual([{ path: 'notes/a', kind: 'directory' }])
  })

  it('moves without overwriting', async () => {
    const fs = new MemoryFs({ files: { 'a.md': '1', 'b.md': '2' } })
    await expect(fs.move('a.md', 'b.md')).rejects.toMatchObject({ code: 'exists' })
    await fs.move('a.md', 'x/c.md')
    expect(await fs.stat('a.md')).toBeNull()
    expect(await fs.readText('x/c.md')).toBe('1')
  })

  it('walk skips ignored directories', async () => {
    const fs = new MemoryFs({ files: { 'n.md': '', '.obsidian/app.json': '{}', '.trash/old.md': '' } })
    const paths: string[] = []
    for await (const s of fs.walk()) paths.push(s.path)
    expect(paths).toEqual(['n.md'])
  })

  it('removes directories recursively', async () => {
    const fs = new MemoryFs({ files: { 'd/a.md': '', 'd/e/b.md': '', 'keep.md': '' } })
    await fs.remove('d')
    const paths: string[] = []
    for await (const s of fs.walk()) paths.push(s.path)
    expect(paths).toEqual(['keep.md'])
  })
})
