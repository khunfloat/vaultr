import type { EditorView } from '@codemirror/view'
import { EditorSelection } from '@codemirror/state'
import { FolderInput, MoreHorizontal, PanelRight, Trash2 } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { PageHeader } from '@/app/PageHeader'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { MarkdownEditor } from '@/editor/MarkdownEditor'
import { MarkdownView } from '@/editor/MarkdownView'
import { toggleTaskLine } from '@/markdown/tasks'
import type { Heading } from '@/markdown/extract'
import { extractFacts } from '@/markdown/extract'
import { routes } from '@/lib/routes'
import { renameNote, trashPath } from '@/services/notes'
import { basename, dirname, stem } from '@/vault/paths'
import { useVault } from '@/vault/vault-store'
import { ConflictBanner } from './ConflictBanner'
import { useNotesUi } from './notes-store'
import { PropertiesPanel } from './PropertiesPanel'
import { RightPanel } from './RightPanel'
import { SaveIndicator } from './SaveIndicator'
import { useDocument } from './use-document'
import { useEditorContext } from './use-editor-context'

export function NoteView({ path }: { path: string }) {
  const doc = useDocument(path)
  const context = useEditorContext(path)
  const readOnly = useVault((s) => s.status !== 'ready')
  const { mode, setMode, rightPanelOpen, toggleRightPanel, renameTab, closeTab, setMoving } = useNotesUi()
  const navigate = useNavigate()
  const editorView = useRef<EditorView | null>(null)
  const headings = extractFacts(doc.body).headings

  const folders = dirname(path).replace(/^notes\/?/, '').split('/').filter(Boolean)

  const rename = async (name: string) => {
    if (name === stem(path)) return
    try {
      await doc.flush()
      const result = await renameNote(path, name)
      renameTab(path, result.path)
      navigate(routes.note(result.path), { replace: true })
      if (result.relinked) toast.success(`Updated links in ${result.relinked} file${result.relinked > 1 ? 's' : ''}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Rename failed')
    }
  }

  const remove = async () => {
    await doc.flush()
    await trashPath(path)
    const next = closeTab(path)
    navigate(next ? routes.note(next) : routes.notes())
    toast.success('Moved to .trash')
  }

  const goToHeading = useCallback(
    (h: Heading) => {
      const view = editorView.current
      if (view) {
        const line = view.state.doc.line(Math.min(h.line + 1, view.state.doc.lines))
        view.dispatch({ selection: EditorSelection.cursor(line.from), effects: [], scrollIntoView: true })
        view.focus()
        return
      }
      const el = [...document.querySelectorAll('.md-prose h1, .md-prose h2, .md-prose h3, .md-prose h4, .md-prose h5, .md-prose h6')].find((e) => e.textContent === h.text)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    },
    [],
  )

  const onToggleTask = useCallback((line: number) => doc.setBody(toggleTaskLine(doc.body, line)), [doc])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        actions={
          <>
            <SaveIndicator state={doc.save} error={doc.error} onRetry={() => void doc.flush()} />
            <ToggleGroup type="single" size="sm" variant="outline" value={mode} onValueChange={(v) => v && setMode(v as typeof mode)}>
              <ToggleGroupItem value="live">Live</ToggleGroupItem>
              <ToggleGroupItem value="source">Source</ToggleGroupItem>
              <ToggleGroupItem value="reading">Reading</ToggleGroupItem>
            </ToggleGroup>
            <Button variant="ghost" size="icon-sm" onClick={toggleRightPanel} aria-label="Toggle side panel" className={rightPanelOpen ? 'text-foreground' : 'text-muted-foreground'}>
              <PanelRight />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Note actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled={readOnly} onSelect={() => setMoving(path)}>
                  <FolderInput /> Move to…
                </DropdownMenuItem>
                <DropdownMenuItem disabled={readOnly} variant="destructive" onSelect={() => void remove()}>
                  <Trash2 /> Move to trash
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      >
        {folders.map((f, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {f} <span className="text-subtle-foreground">/</span>
          </span>
        ))}
        <b className="truncate">{stem(path)}</b>
      </PageHeader>

      {doc.conflict && <ConflictBanner onReload={() => void doc.resolveConflict('reload')} onKeepMine={() => void doc.resolveConflict('keep-mine')} />}

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-auto" data-note-scroll>
          {doc.status === 'loading' && <div className="p-10 text-muted-foreground">Loading…</div>}
          {doc.status === 'missing' && <div className="p-10 text-muted-foreground">This note was moved or deleted.</div>}
          {doc.status === 'ready' && (
            <article className="mx-auto max-w-190 px-10 pt-6 pb-10">
              <InlineTitle key={path} name={stem(path)} readOnly={readOnly} onRename={rename} />
              <PropertiesPanel data={doc.frontmatter} error={doc.frontmatterError} readOnly={readOnly} onPatch={(p) => void doc.patchFrontmatter(p)} />
              {mode === 'reading' ? (
                <MarkdownView source={doc.body} context={context} onToggleTask={readOnly ? undefined : onToggleTask} />
              ) : (
                <MarkdownEditor
                  key={`${path}:${doc.version}`}
                  initialValue={doc.body}
                  onChange={doc.setBody}
                  context={context}
                  mode={mode}
                  readOnly={readOnly}
                  placeholder="Start writing, or type / for blocks…"
                  onBlur={() => void doc.flush()}
                  onReady={(v) => (editorView.current = v)}
                  fileName={basename(path)}
                />
              )}
            </article>
          )}
        </div>
        {rightPanelOpen && doc.status === 'ready' && <RightPanel path={path} headings={headings} onHeading={goToHeading} />}
      </div>
    </div>
  )
}

function InlineTitle({ name, readOnly, onRename }: { name: string; readOnly: boolean; onRename(name: string): void }) {
  const [draft, setDraft] = useState(name)
  return (
    <input
      aria-label="Note title"
      className="mb-4 w-full bg-transparent text-[28px] leading-tight font-semibold tracking-tight outline-none placeholder:text-subtle-foreground"
      value={draft}
      readOnly={readOnly}
      placeholder="Untitled"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => (draft.trim() ? onRename(draft.trim()) : setDraft(name))}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          ;(e.target as HTMLInputElement).blur()
          ;(document.querySelector('.md-editor .cm-content') as HTMLElement | null)?.focus()
        }
        if (e.key === 'Escape') {
          setDraft(name)
          ;(e.target as HTMLInputElement).blur()
        }
      }}
    />
  )
}
