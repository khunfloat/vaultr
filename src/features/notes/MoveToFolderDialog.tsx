import { CornerDownRight, Folder, FolderRoot } from 'lucide-react'
import { useMemo } from 'react'
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { VAULT_DIRS } from '@/vault/config'
import { basename, dirname, isInside } from '@/vault/paths'
import { useVault } from '@/vault/vault-store'
import { useNotesUi } from './notes-store'
import { useTreeActions } from './use-tree-actions'

/** Keyboard-friendly alternative to drag and drop: pick a destination folder from a searchable list. */
export function MoveToFolderDialog() {
  const moving = useNotesUi((s) => s.moving)
  const setMoving = useNotesUi((s) => s.setMoving)
  const dirs = useVault((s) => s.dirs)
  const files = useVault((s) => s.files)
  const actions = useTreeActions()

  const isFolder = moving ? dirs.has(moving) : false
  const parent = moving ? dirname(moving) : null

  const folders = useMemo(() => {
    if (!moving) return []
    return [VAULT_DIRS.notes, ...[...dirs].filter((d) => isInside(d, VAULT_DIRS.notes) && d !== VAULT_DIRS.notes)]
      .filter((d) => !(isFolder && isInside(d, moving)))
      .sort((a, b) => (a === VAULT_DIRS.notes ? -1 : b === VAULT_DIRS.notes ? 1 : a.localeCompare(b, ['th', 'en'], { numeric: true })))
  }, [dirs, moving, isFolder])

  const name = moving ? (isFolder ? basename(moving) : (files.get(moving)?.title ?? basename(moving))) : ''

  return (
    <CommandDialog open={!!moving} onOpenChange={(o) => !o && setMoving(null)} title="Move to folder" description={`Choose where to move ${name}`} className="sm:max-w-lg">
      <Command>
        <div className="flex items-center gap-2 border-b px-3 py-2 text-xs text-muted-foreground">
          <CornerDownRight className="size-3.5" />
          Move <b className="truncate text-foreground">{name}</b> to…
        </div>
        <CommandInput placeholder="Type a folder name…" />
        <CommandList className="max-h-[360px]">
          <CommandEmpty>No folder matches</CommandEmpty>
          <CommandGroup heading="Folders">
            {folders.map((folder) => {
              const isCurrent = folder === parent
              const label = folder === VAULT_DIRS.notes ? 'Notes (top level)' : folder.slice(VAULT_DIRS.notes.length + 1)
              return (
                <CommandItem
                  key={folder}
                  value={folder}
                  keywords={[basename(folder), label]}
                  disabled={isCurrent}
                  onSelect={() => {
                    const from = moving!
                    setMoving(null)
                    void actions.move(from, folder)
                  }}
                >
                  {folder === VAULT_DIRS.notes ? <FolderRoot /> : <Folder />}
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  {isCurrent && <span className="text-xs text-subtle-foreground">current</span>}
                </CommandItem>
              )
            })}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
