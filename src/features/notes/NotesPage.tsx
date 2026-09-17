import { FileText, Plus } from 'lucide-react'
import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { PageHeader } from '@/app/PageHeader'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Kbd } from '@/components/ui/kbd'
import { notePathFromSplat, routes } from '@/lib/routes'
import { createNote } from '@/services/notes'
import { useTargetFolder } from './use-tree-actions'
import { VAULT_DIRS } from '@/vault/config'
import { dirname, isInside } from '@/vault/paths'
import { useVault } from '@/vault/vault-store'
import { NoteTabs } from './NoteTabs'
import { NoteView } from './NoteView'
import { useNotesUi } from './notes-store'

export function NotesPage() {
  const params = useParams()
  const path = notePathFromSplat(params['*']) || null
  const openTab = useNotesUi((s) => s.openTab)
  const setCurrentFolder = useNotesUi((s) => s.setCurrentFolder)
  const tabs = useNotesUi((s) => s.tabs)
  const navigate = useNavigate()
  const readOnly = useVault((s) => s.status !== 'ready')
  const targetFolder = useTargetFolder()

  useEffect(() => {
    if (!path) return
    openTab(path)
    if (isInside(path, VAULT_DIRS.notes)) setCurrentFolder(dirname(path))
  }, [path, openTab, setCurrentFolder])

  // Landing on /notes with tabs open: return to the last tab.
  useEffect(() => {
    if (!path && tabs.length) navigate(routes.note(tabs[tabs.length - 1]), { replace: true })
  }, [path, tabs, navigate])

  const newNote = async () => {
    try {
      const created = await createNote(targetFolder)
      navigate(routes.note(created))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create note')
    }
  }

  return (
    <>
      <NoteTabs active={path} />
      {path ? (
        <NoteView key={path} path={path} />
      ) : (
        <>
          <PageHeader>
            <FileText className="size-4" /> <b>Notes</b>
          </PageHeader>
          <Empty className="flex-1">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileText />
              </EmptyMedia>
              <EmptyTitle>No note open</EmptyTitle>
              <EmptyDescription>
                Pick a note from the sidebar or press <Kbd>Ctrl O</Kbd>
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={() => void newNote()} disabled={readOnly}>
                <Plus /> New note
              </Button>
            </EmptyContent>
          </Empty>
        </>
      )}
    </>
  )
}
