import { ChevronRight, FilePlus, FileText, Folder, FolderInput, FolderPlus, Pencil, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu'
import { routes } from '@/lib/routes'
import { buildTree, type TreeFolder, type TreeNode } from '@/lib/tree'
import { cn } from '@/lib/utils'
import { VAULT_DIRS } from '@/vault/config'
import { basename, dirname, isInside, stem } from '@/vault/paths'
import { useVault } from '@/vault/vault-store'
import { useNotesUi } from './notes-store'
import { type TreeActions, useTargetFolder, useTreeActions } from './use-tree-actions'

const DRAG_TYPE = 'application/x-vault-path'

export function FileTree() {
  const files = useVault((s) => s.files)
  const dirs = useVault((s) => s.dirs)
  const readOnly = useVault((s) => s.status !== 'ready')
  const actions = useTreeActions()
  const expandedSet = useMemo(() => new Set(actions.expanded), [actions.expanded])
  const [dropRoot, setDropRoot] = useState(false)

  const tree = useMemo(() => {
    const notes = [...files.values()].filter((f) => f.kind === 'note' && isInside(f.path, VAULT_DIRS.notes)).map((f) => f.path)
    const nodes = buildTree(notes, VAULT_DIRS.notes)
    // Add empty folders the file list can't reveal.
    const byPath = new Map<string, TreeFolder>()
    const walk = (list: TreeNode[]) => list.forEach((n) => n.kind === 'folder' && (byPath.set(n.path, n), walk(n.children)))
    walk(nodes)
    const root: TreeFolder = { kind: 'folder', name: '', path: VAULT_DIRS.notes, children: nodes }
    byPath.set(VAULT_DIRS.notes, root)
    for (const d of [...dirs].filter((d) => isInside(d, VAULT_DIRS.notes) && d !== VAULT_DIRS.notes).sort()) {
      if (byPath.has(d)) continue
      const parent = byPath.get(dirname(d))
      if (!parent) continue
      const folder: TreeFolder = { kind: 'folder', name: basename(d), path: d, children: [] }
      parent.children.push(folder)
      parent.children.sort((a, b) => (a.kind !== b.kind ? (a.kind === 'folder' ? -1 : 1) : a.name.localeCompare(b.name, ['th', 'en'], { numeric: true })))
      byPath.set(d, folder)
    }
    return root.children
  }, [files, dirs])

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild disabled={readOnly}>
        <div
          role="tree"
          className={cn('min-h-full px-2 pb-6', dropRoot && 'bg-sidebar-accent/40')}
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes(DRAG_TYPE)) return
            e.preventDefault()
            setDropRoot(true)
          }}
          onDragLeave={() => setDropRoot(false)}
          onDrop={(e) => {
            setDropRoot(false)
            const from = e.dataTransfer.getData(DRAG_TYPE)
            if (from) void actions.move(from, VAULT_DIRS.notes)
          }}
        >
          {tree.length === 0 && <p className="px-2 py-2 text-xs text-subtle-foreground">No notes yet</p>}
          {tree.map((node) => (
            <Node key={node.path} node={node} depth={0} expanded={expandedSet} actions={actions} readOnly={readOnly} />
          ))}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => void actions.newNote(VAULT_DIRS.notes)}>
          <FilePlus /> New note
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => void actions.newFolder(VAULT_DIRS.notes)}>
          <FolderPlus /> New folder
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

function Node({ node, depth, expanded, actions, readOnly }: { node: TreeNode; depth: number; expanded: Set<string>; actions: TreeActions; readOnly: boolean }) {
  const location = useLocation()
  const setMoving = useNotesUi((s) => s.setMoving)
  const setCurrentFolder = useNotesUi((s) => s.setCurrentFolder)
  const targetFolder = useTargetFolder()
  const [dropHere, setDropHere] = useState(false)
  const pad = { paddingLeft: 8 + depth * 14 }
  const rowClass =
    'flex h-7 w-full items-center gap-1.5 rounded-md pr-2 text-left text-muted-foreground outline-none hover:bg-sidebar-accent/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring'
  const renaming = actions.renaming === node.path

  const dragProps = readOnly
    ? {}
    : {
        draggable: !renaming,
        onDragStart: (e: React.DragEvent) => {
          e.dataTransfer.setData(DRAG_TYPE, node.path)
          e.dataTransfer.effectAllowed = 'move'
        },
      }

  const label = renaming ? (
    <input
      autoFocus
      defaultValue={node.kind === 'file' ? stem(node.name) : node.name}
      className="h-6 min-w-0 flex-1 rounded border border-ring bg-background px-1 text-foreground outline-none"
      onFocus={(e) => e.target.select()}
      onClick={(e) => e.preventDefault()}
      onBlur={(e) => void actions.rename(node, e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') actions.setRenaming(null)
      }}
    />
  ) : (
    <span className="truncate">{node.kind === 'file' ? stem(node.name) : node.name}</span>
  )

  const menu = (
    <ContextMenuContent>
      {node.kind === 'folder' && (
        <>
          <ContextMenuItem onSelect={() => void actions.newNote(node.path)}>
            <FilePlus /> New note
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => void actions.newFolder(node.path)}>
            <FolderPlus /> New folder
          </ContextMenuItem>
          <ContextMenuSeparator />
        </>
      )}
      <ContextMenuItem onSelect={() => setTimeout(() => actions.setRenaming(node.path), 50)}>
        <Pencil /> Rename
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => setMoving(node.path)}>
        <FolderInput /> Move to…
      </ContextMenuItem>
      <ContextMenuItem variant="destructive" onSelect={() => void actions.remove(node)}>
        <Trash2 /> Move to trash
      </ContextMenuItem>
    </ContextMenuContent>
  )

  if (node.kind === 'file') {
    const to = routes.note(node.path)
    const active = decodeURIComponent(location.pathname) === decodeURIComponent(to)
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild disabled={readOnly}>
          <NavLink role="treeitem" to={to} style={pad} className={cn(rowClass, active && 'bg-sidebar-accent text-foreground')} title={node.path} {...dragProps}>
            <span className="w-3.5 shrink-0" />
            <FileText className="size-3.5 shrink-0" />
            {label}
          </NavLink>
        </ContextMenuTrigger>
        {menu}
      </ContextMenu>
    )
  }

  const open = expanded.has(node.path)
  const toggle = () => actions.setExpanded((prev) => (prev.includes(node.path) ? prev.filter((p) => p !== node.path) : [...prev, node.path]))
  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild disabled={readOnly}>
          <button
            role="treeitem"
            aria-expanded={open}
            style={pad}
            className={cn(rowClass, targetFolder === node.path && 'text-foreground', dropHere && 'bg-sidebar-accent text-foreground ring-1 ring-ring')}
            onClick={() => {
              if (renaming) return
              toggle()
              setCurrentFolder(node.path)
            }}
            {...dragProps}
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes(DRAG_TYPE)) return
              e.preventDefault()
              e.stopPropagation()
              setDropHere(true)
            }}
            onDragLeave={() => setDropHere(false)}
            onDrop={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setDropHere(false)
              const from = e.dataTransfer.getData(DRAG_TYPE)
              if (from) void actions.move(from, node.path)
            }}
          >
            <ChevronRight className={cn('size-3.5 shrink-0 opacity-60 transition-transform', open && 'rotate-90')} />
            <Folder className={cn('size-3.5 shrink-0 text-subtle-foreground', targetFolder === node.path && 'fill-status-blue/25 text-status-blue')} />
            {label}
          </button>
        </ContextMenuTrigger>
        {menu}
      </ContextMenu>
      {open && node.children.map((child) => <Node key={child.path} node={child} depth={depth + 1} expanded={expanded} actions={actions} readOnly={readOnly} />)}
    </>
  )
}
