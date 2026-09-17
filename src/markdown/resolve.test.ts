import { createResolver } from './resolve'

const f = (path: string, kind: 'note' | 'ticket' | 'attachment' = 'note', key?: string) => ({
  path,
  kind,
  frontmatter: key ? { key } : {},
})

const files = [
  f('notes/Projects/Login flow.md'),
  f('notes/Inbox.md'),
  f('notes/a/Dup.md'),
  f('notes/b/deeper/Dup.md'),
  f('tickets/TD-12.md', 'ticket', 'TD-12'),
  f('attachments/shot one.png', 'attachment'),
]

describe('createResolver', () => {
  const r = createResolver(files)

  it('resolves by name, case-insensitive', () => {
    expect(r.resolve('login flow')).toBe('notes/Projects/Login flow.md')
    expect(r.resolve('Inbox.md')).toBe('notes/Inbox.md')
  })

  it('resolves full and partial paths', () => {
    expect(r.resolve('notes/Inbox')).toBe('notes/Inbox.md')
    expect(r.resolve('Projects/Login flow')).toBe('notes/Projects/Login flow.md')
    expect(r.resolve('attachments/shot one.png')).toBe('attachments/shot one.png')
    expect(r.resolve('nope/Login flow')).toBeNull()
  })

  it('resolves ticket keys', () => {
    expect(r.resolve('td-12')).toBe('tickets/TD-12.md')
  })

  it('disambiguates duplicates: same folder first, then shortest path', () => {
    expect(r.resolve('Dup', 'notes/b/deeper/x.md')).toBe('notes/b/deeper/Dup.md')
    expect(r.resolve('Dup', 'notes/Inbox.md')).toBe('notes/a/Dup.md')
  })

  it('returns null for unknown or empty', () => {
    expect(r.resolve('Missing')).toBeNull()
    expect(r.resolve('  ')).toBeNull()
  })

  it('builds link text', () => {
    expect(r.linkText('notes/Projects/Login flow.md')).toBe('Login flow')
    expect(r.linkText('notes/a/Dup.md')).toBe('notes/a/Dup')
    expect(r.linkText('tickets/TD-12.md')).toBe('TD-12')
    expect(r.linkText('attachments/shot one.png')).toBe('attachments/shot one.png')
  })
})
