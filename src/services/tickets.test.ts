import { MemoryFs } from '@/vault/memory-fs'
import { useVault } from '@/vault/vault-store'
import { archiveDoneTickets, createTicket, moveTicket, orderBetween, ticketsFromFiles, updateTicket } from './tickets'

async function setup(files: Record<string, string> = {}) {
  const fs = new MemoryFs({ files })
  vi.stubGlobal('window', { setInterval: () => 0, clearInterval: () => {}, addEventListener: () => {}, removeEventListener: () => {} })
  vi.stubGlobal('document', { visibilityState: 'hidden', addEventListener: () => {}, removeEventListener: () => {} })
  await useVault.getState().attach(fs)
  return fs
}

const tickets = () => ticketsFromFiles(useVault.getState().files.values())
const column = (status: string) => tickets().filter((t) => t.status === status).map((t) => t.key)

describe('tickets', () => {
  it('creates sequential keys, appends to column and bumps config', async () => {
    const fs = await setup({ 'tickets/TD-7.md': '---\nkey: TD-7\nstatus: todo\norder: a0\n---\n' })
    const t = await createTicket({ title: 'แก้ bug' })
    expect(t).toMatchObject({ key: 'TD-8', title: 'แก้ bug', status: 'todo', priority: 'medium' })
    expect(column('todo')).toEqual(['TD-7', 'TD-8'])
    expect(JSON.parse(await fs.readText('.vaultr/config.json')).nextTicketNumber).toBe(9)
    expect((await createTicket({ title: 'x' })).key).toBe('TD-9')
  })

  it('updates fields, preserving unknown frontmatter and body', async () => {
    const fs = await setup({ 'tickets/TD-1.md': '---\nkey: TD-1\ntitle: A\nstatus: todo\ncustom: keep\n---\nbody' })
    await updateTicket('tickets/TD-1.md', { status: 'done', deadline: '2026-10-01', labels: ['bug'] })
    const text = await fs.readText('tickets/TD-1.md')
    expect(text).toContain('custom: keep')
    expect(text).toMatch(/done: \d{4}-/)
    expect(text.endsWith('body')).toBe(true)
    await updateTicket('tickets/TD-1.md', { status: 'todo', deadline: null })
    const after = await fs.readText('tickets/TD-1.md')
    expect(after).not.toMatch(/^done:/m)
    expect(after).not.toContain('deadline')
  })

  it('moves between neighbours using fractional keys', async () => {
    await setup()
    const a = await createTicket({ title: 'a' })
    const b = await createTicket({ title: 'b' })
    const c = await createTicket({ title: 'c', status: 'in-progress' })
    await moveTicket(c.path, 'todo', a.path, b.path)
    expect(column('todo')).toEqual(['TD-1', 'TD-3', 'TD-2'])
    await moveTicket(a.path, 'done', null, null)
    expect(column('done')).toEqual(['TD-1'])
  })

  it('rebalances a column with invalid or duplicate order keys', async () => {
    await setup({
      'tickets/TD-1.md': '---\nkey: TD-1\nstatus: todo\norder: x\n---\n',
      'tickets/TD-2.md': '---\nkey: TD-2\nstatus: todo\norder: x\n---\n',
      'tickets/TD-3.md': '---\nkey: TD-3\nstatus: done\n---\n',
    })
    await moveTicket('tickets/TD-3.md', 'todo', 'tickets/TD-1.md', 'tickets/TD-2.md')
    expect(column('todo')).toEqual(['TD-1', 'TD-3', 'TD-2'])
  })

  it('orderBetween rejects bad neighbours', () => {
    expect(orderBetween(null, null)).toBe('a0')
    expect(orderBetween('a1', 'a0')).toBeNull()
    expect(orderBetween('zz!', null)).toBeNull()
  })

  it('archives old done tickets', async () => {
    await setup({
      'tickets/TD-1.md': '---\nkey: TD-1\nstatus: done\ndone: 2026-01-01T00:00:00+07:00\n---\n',
      'tickets/TD-2.md': '---\nkey: TD-2\nstatus: done\ndone: 2026-09-10T00:00:00+07:00\n---\n',
    })
    expect(await archiveDoneTickets(30, new Date('2026-09-17'))).toBe(1)
    expect(column('done')).toEqual(['TD-2'])
    expect(useVault.getState().files.has('tickets/archive/TD-1.md')).toBe(true)
  })
})
