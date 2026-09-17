import { useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { routes } from '@/lib/routes'
import type { TreeNode } from '@/lib/tree'
import { createFolder, createNote, moveAndRelink, renameNote, trashPath } from '@/services/notes'
import { uniquePath } from '@/services/vault-ops'
import { VAULT_DIRS } from '@/vault/config'
import { basename, dirname, isInside, joinPath, stem } from '@/vault/paths'
import { useVault } from '@/vault/vault-store'
import { useNotesUi } from './notes-store'

export function useTreeActions() {
  const navigate = useNavigate()
  const { renameTab, closeTab, expanded, setExpanded, renaming, setRenaming } = useNotesUi()
  const location = useLocation()

  const expand = (path: string) => setExpanded((prev) => (prev.includes(path) ? prev : [...prev, path]))

  const guard = async (fn: () => Promise<void>) => {
    try {
      await fn()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  const retargetTabs = (pairs: [string, string][]) => {
    for (const [from, to] of pairs) renameTab(from, to)
    const current = decodeURIComponent(location.pathname)
    const hit = pairs.find(([from]) => decodeURIComponent(routes.note(from)) === current)
    if (hit) navigate(routes.note(hit[1]), { replace: true })
  }

  return {
    expanded,
    setExpanded,
    renaming,
    setRenaming,
    newNote: (folder: string) =>
      guard(async () => {
        if (folder !== VAULT_DIRS.notes) expand(folder)
        const path = await createNote(folder)
        navigate(routes.note(path))
      }),
    newFolder: (parent: string) =>
      guard(async () => {
        if (parent !== VAULT_DIRS.notes) expand(parent)
        const path = await createFolder(joinPath(parent, 'New folder'))
        setRenaming(path)
      }),
    rename: (node: TreeNode, name: string) =>
      guard(async () => {
        setRenaming(null)
        const clean = name.trim()
        if (!clean || clean === (node.kind === 'file' ? stem(node.name) : node.name)) return
        if (node.kind === 'file') {
          const result = await renameNote(node.path, clean)
          retargetTabs(result.pairs)
          if (result.relinked) toast.success(`Updated links in ${result.relinked} file${result.relinked > 1 ? 's' : ''}`)
        } else {
          const target = joinPath(dirname(node.path), clean.replace(/[\\/:*?"<>|]/g, '-'))
          if (useVault.getState().dirs.has(target)) throw new Error(`"${clean}" already exists`)
          const result = await moveAndRelink(node.path, target)
          setExpanded((prev) => prev.map((p) => (isInside(p, node.path) ? target + p.slice(node.path.length) : p)))
          retargetTabs(result.pairs)
        }
      }),
    move: (from: string, toFolder: string) =>
      guard(async () => {
        if (dirname(from) === toFolder || isInside(toFolder, from)) return
        const dest = await uniquePath(joinPath(toFolder, basename(from)))
        const result = await moveAndRelink(from, dest)
        if (toFolder !== VAULT_DIRS.notes) expand(toFolder)
        retargetTabs(result.pairs)
      }),
    remove: (node: TreeNode) =>
      guard(async () => {
        const { files } = useVault.getState()
        const affected = node.kind === 'file' ? [node.path] : [...files.keys()].filter((p) => isInside(p, node.path))
        await trashPath(node.path)
        let next: string | null = null
        for (const p of affected) next = closeTab(p)
        if (affected.some((p) => decodeURIComponent(routes.note(p)) === decodeURIComponent(location.pathname))) navigate(next ? routes.note(next) : routes.notes())
        toast.success(`Moved ${node.kind === 'file' ? `"${stem(node.name)}"` : `folder "${node.name}"`} to .trash`)
      }),
  }
}

export type TreeActions = ReturnType<typeof useTreeActions>

/** Folder that sidebar "New note/New folder" target; falls back to notes/ if it no longer exists. */
export function useTargetFolder(): string {
  const currentFolder = useNotesUi((s) => s.currentFolder)
  const dirs = useVault((s) => s.dirs)
  return currentFolder !== VAULT_DIRS.notes && dirs.has(currentFolder) && isInside(currentFolder, VAULT_DIRS.notes) ? currentFolder : VAULT_DIRS.notes
}

export function useNotesRootActions() {
  const actions = useTreeActions()
  const folder = useTargetFolder()
  return { folder, newNote: () => actions.newNote(folder), newFolder: () => actions.newFolder(folder) }
}
