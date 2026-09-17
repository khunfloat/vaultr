export interface TreeFolder {
  kind: 'folder'
  name: string
  path: string
  children: TreeNode[]
}

export interface TreeFile {
  kind: 'file'
  name: string
  path: string
}

export type TreeNode = TreeFolder | TreeFile

const collator = new Intl.Collator(['th', 'en'], { numeric: true, sensitivity: 'base' })

/**
 * Build a folder tree from file paths. `root` is stripped from displayed paths' structure
 * (e.g. root `notes` turns `notes/a/b.md` into folder `a` → file `b.md`), but node paths stay vault-relative.
 */
export function buildTree(filePaths: Iterable<string>, root = ''): TreeNode[] {
  const top: TreeFolder = { kind: 'folder', name: '', path: root, children: [] }
  const folders = new Map<string, TreeFolder>([[root, top]])
  const prefix = root ? root + '/' : ''

  for (const path of filePaths) {
    const rel = prefix && path.startsWith(prefix) ? path.slice(prefix.length) : path
    const parts = rel.split('/')
    let parent = top
    let current = prefix && path.startsWith(prefix) ? root : ''
    for (const part of parts.slice(0, -1)) {
      current = current ? `${current}/${part}` : part
      let folder = folders.get(current)
      if (!folder) {
        folder = { kind: 'folder', name: part, path: current, children: [] }
        folders.set(current, folder)
        parent.children.push(folder)
      }
      parent = folder
    }
    parent.children.push({ kind: 'file', name: parts[parts.length - 1], path })
  }

  sortTree(top)
  return top.children
}

function sortTree(folder: TreeFolder) {
  folder.children.sort((a, b) => (a.kind !== b.kind ? (a.kind === 'folder' ? -1 : 1) : collator.compare(a.name, b.name)))
  for (const child of folder.children) if (child.kind === 'folder') sortTree(child)
}
