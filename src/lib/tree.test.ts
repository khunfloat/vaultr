import { buildTree } from './tree'

describe('buildTree', () => {
  it('nests folders, sorts folders first, Thai collation, natural numbers', () => {
    const tree = buildTree(['notes/b.md', 'notes/Projects/x/2.md', 'notes/Projects/x/10.md', 'notes/a.md', 'notes/ก.md'], 'notes')
    expect(tree.map((n) => n.name)).toEqual(['Projects', 'ก.md', 'a.md', 'b.md'])
    const projects = tree[0]
    expect(projects).toMatchObject({ kind: 'folder', path: 'notes/Projects' })
    if (projects.kind !== 'folder') throw new Error()
    const x = projects.children[0]
    if (x.kind !== 'folder') throw new Error()
    expect(x.children.map((n) => n.path)).toEqual(['notes/Projects/x/2.md', 'notes/Projects/x/10.md'])
  })

  it('keeps files outside the root at top level with full paths', () => {
    const tree = buildTree(['Inbox.md', 'notes/a.md', 'other/c.md'], 'notes')
    expect(tree.map((n) => n.path)).toEqual(['other', 'notes/a.md', 'Inbox.md'])
  })
})
