import { FileText, Kanban, Link2, Maximize2, Minimize2, MoreHorizontal, PanelRightClose, PanelRightOpen, Paperclip, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { MarkdownEditor } from '@/editor/MarkdownEditor'
import { MarkdownView } from '@/editor/MarkdownView'
import { toggleTaskLine } from '@/markdown/tasks'
import { ConflictBanner } from '@/features/notes/ConflictBanner'
import { SaveIndicator } from '@/features/notes/SaveIndicator'
import { useDocument } from '@/features/notes/use-document'
import { useEditorContext, useOpenLink } from '@/features/notes/use-editor-context'
import { useLinkGraph } from '@/index/use-link-graph'
import { formatDate } from '@/lib/dates'
import { useStoredState } from '@/lib/use-stored-state'
import { cn } from '@/lib/utils'
import { attachmentUrl } from '@/services/attachments'
import { deleteTicket, ticketFrontmatterPatch, ticketsFromFiles, toTicket, type TicketPatch } from '@/services/tickets'
import { basename } from '@/vault/paths'
import { useVault } from '@/vault/vault-store'
import { DeadlinePicker } from './DeadlinePicker'
import { DeadlineBadge, LabelBadge, PriorityIcon, StatusIcon } from './TicketBadges'
import { PRIORITIES, PRIORITY_LABEL, STATUS_LABEL, TICKET_STATUSES, type Priority, type TicketStatus } from './ticket-meta'

export function TicketDialog({ path, onClose }: { path: string | null; onClose(): void }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <Dialog open={!!path} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          'flex flex-col gap-0 overflow-hidden p-0 sm:max-w-none',
          expanded ? 'h-[calc(100vh-24px)] w-[calc(100vw-24px)]' : 'h-[min(760px,calc(100vh-48px))] w-[min(1080px,calc(100vw-48px))]',
        )}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {path && <TicketDetail key={path} path={path} expanded={expanded} onToggleExpand={() => setExpanded(!expanded)} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function TicketDetail({ path, expanded, onToggleExpand, onClose }: { path: string; expanded: boolean; onToggleExpand(): void; onClose(): void }) {
  const doc = useDocument(path)
  const context = useEditorContext(path)
  const file = useVault((s) => s.files.get(path))
  const readOnly = useVault((s) => s.status !== 'ready')
  const [mode, setMode] = useState<'live' | 'source' | 'reading'>('live')
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Remembered across tickets and sessions, like a Jira side panel.
  const [detailsOpen, setDetailsOpen] = useStoredState('vaultr:ticket-details-open', true)
  const ticket = file ? toTicket(file) : null

  const patch = (p: TicketPatch) => void doc.patchFrontmatter(ticketFrontmatterPatch(doc.frontmatter.status, p))

  if (!ticket) {
    return (
      <div className="grid flex-1 place-items-center text-muted-foreground">
        <DialogTitle className="sr-only">Ticket not found</DialogTitle>
        This ticket was moved or deleted.
      </div>
    )
  }

  const remove = async () => {
    await doc.flush()
    await deleteTicket(path)
    toast.success(`${ticket.key} moved to .trash`)
    onClose()
  }

  return (
    <>
      <div className="flex h-12 shrink-0 items-center gap-2 border-b pr-3 pl-5">
        <Kanban className="size-4 text-muted-foreground" />
        <span className="text-muted-foreground">Board</span>
        <span className="text-subtle-foreground">/</span>
        <span className="font-mono text-[13px] font-medium">{ticket.key}</span>
        <div className="flex-1" />
        <SaveIndicator state={doc.save} error={doc.error} onRetry={() => void doc.flush()} />
        <span className="hidden text-xs text-subtle-foreground md:inline">{path}</span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setDetailsOpen(!detailsOpen)}
          aria-label={detailsOpen ? 'Hide details' : 'Show details'}
          aria-pressed={detailsOpen}
          title={detailsOpen ? 'Hide details' : 'Show details'}
        >
          {detailsOpen ? <PanelRightClose /> : <PanelRightOpen />}
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onToggleExpand} aria-label={expanded ? 'Shrink' : 'Expand'}>
          {expanded ? <Minimize2 /> : <Maximize2 />}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Ticket actions">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => {
                void navigator.clipboard?.writeText(`[[${ticket.key}]]`)
                toast.success('Link copied')
              }}
            >
              <Link2 /> Copy link
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" disabled={readOnly} onSelect={() => setConfirmDelete(true)}>
              <Trash2 /> Delete ticket
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
          <X />
        </Button>
      </div>

      {doc.conflict && <ConflictBanner onReload={() => void doc.resolveConflict('reload')} onKeepMine={() => void doc.resolveConflict('keep-mine')} />}

      <div className={cn('grid min-h-0 flex-1', detailsOpen ? 'grid-cols-[1fr_300px]' : 'grid-cols-1')}>
        <div className="min-h-0 overflow-auto px-8 pt-6 pb-10">
          <DialogTitle asChild>
            <TitleInput key={ticket.title} value={ticket.title} readOnly={readOnly} onCommit={(title) => patch({ title })} />
          </DialogTitle>
          <DialogDescription className="sr-only">Ticket details for {ticket.key}</DialogDescription>
          {!detailsOpen && (
            <button
              className="-ml-2 mb-3 flex flex-wrap items-center gap-2 rounded-md px-2 py-1 text-left text-muted-foreground hover:bg-accent"
              onClick={() => setDetailsOpen(true)}
              title="Show details"
            >
              <span className="flex items-center gap-1.5">
                <StatusIcon status={ticket.status} className="size-3.5" /> {STATUS_LABEL[ticket.status]}
              </span>
              <span className="flex items-center gap-1">
                <PriorityIcon priority={ticket.priority} /> {PRIORITY_LABEL[ticket.priority]}
              </span>
              <DeadlineBadge deadline={ticket.deadline} done={ticket.status === 'done'} />
              {ticket.labels.map((l) => (
                <LabelBadge key={l} label={l} />
              ))}
            </button>
          )}
          {ticket.frontmatterError && (
            <p className="mb-3 rounded-md bg-status-red/10 px-3 py-2 text-xs text-status-red">Frontmatter is invalid ({ticket.frontmatterError}). Fields can’t be edited until it’s fixed in Source mode.</p>
          )}
          <div className="mb-4 flex items-center gap-2">
            <ToggleGroup type="single" size="sm" variant="outline" value={mode} onValueChange={(v) => v && setMode(v as typeof mode)}>
              <ToggleGroupItem value="live">Live</ToggleGroupItem>
              <ToggleGroupItem value="source">Source</ToggleGroupItem>
              <ToggleGroupItem value="reading">Reading</ToggleGroupItem>
            </ToggleGroup>
            <span className="ml-auto flex items-center gap-1 text-xs text-subtle-foreground">
              <Paperclip className="size-3.5" /> Paste or drop files into the description
            </span>
          </div>
          {doc.status === 'ready' &&
            (mode === 'reading' ? (
              <MarkdownView source={doc.body} context={context} onToggleTask={readOnly ? undefined : (line) => doc.setBody(toggleTaskLine(doc.body, line))} />
            ) : (
              <MarkdownEditor
                key={`${path}:${doc.version}`}
                initialValue={doc.body}
                onChange={doc.setBody}
                context={context}
                mode={mode}
                readOnly={readOnly}
                placeholder="Add a description — type / for blocks, [[ to link, paste screenshots…"
                fileName={basename(path)}
                onBlur={() => void doc.flush()}
              />
            ))}
        </div>
        {detailsOpen && (
          <aside className="min-h-0 overflow-auto border-l bg-white/[0.01] p-4">
            <SideLabel>Details</SideLabel>
            <div className="mb-5 grid grid-cols-[84px_1fr] items-center gap-y-2">
              <span className="text-muted-foreground">Status</span>
              <Select value={ticket.status} onValueChange={(v) => patch({ status: v as TicketStatus })} disabled={readOnly || !!ticket.frontmatterError}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      <StatusIcon status={s} /> {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-muted-foreground">Deadline</span>
              <DeadlinePicker value={ticket.deadline} onChange={(deadline) => patch({ deadline })} disabled={readOnly || !!ticket.frontmatterError} className="h-7" />
              <span className="text-muted-foreground">Priority</span>
              <Select value={ticket.priority} onValueChange={(v) => patch({ priority: v as Priority })} disabled={readOnly || !!ticket.frontmatterError}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      <PriorityIcon priority={p} /> {PRIORITY_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="self-start pt-1 text-muted-foreground">Labels</span>
              <LabelsEditor labels={ticket.labels} readOnly={readOnly || !!ticket.frontmatterError} onChange={(labels) => patch({ labels })} />
              <span className="text-muted-foreground">Created</span>
              <span className="px-1 text-muted-foreground">{formatDate(ticket.created) || '—'}</span>
              <span className="text-muted-foreground">Updated</span>
              <span className="px-1 text-muted-foreground">{formatDate(ticket.updated) || '—'}</span>
              {ticket.done && (
                <>
                  <span className="text-muted-foreground">Done</span>
                  <span className="px-1 text-muted-foreground">{formatDate(ticket.done)}</span>
                </>
              )}
            </div>
            <LinkedNotes path={path} />
            <Attachments path={path} />
          </aside>
        )}
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {ticket.key}?</AlertDialogTitle>
            <AlertDialogDescription>The file is moved to the vault’s .trash folder, so it can be restored from File Explorer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void remove()}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function SideLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-[11px] font-medium tracking-wide text-subtle-foreground uppercase">{children}</p>
}

const TitleInput = ({ value, readOnly, onCommit, ...rest }: { value: string; readOnly: boolean; onCommit(v: string): void }) => {
  const [draft, setDraft] = useState(value)
  return (
    <textarea
      {...rest}
      rows={1}
      aria-label="Ticket title"
      className="field-sizing-content mb-3 -ml-2 w-[calc(100%+8px)] resize-none rounded-md bg-transparent px-2 py-1 text-[22px] leading-snug font-semibold tracking-tight outline-none hover:bg-accent focus:bg-accent"
      value={draft}
      readOnly={readOnly}
      onChange={(e) => setDraft(e.target.value.replace(/\n/g, ' '))}
      onBlur={() => {
        const v = draft.trim()
        if (v && v !== value) onCommit(v)
        else setDraft(value)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          ;(e.target as HTMLTextAreaElement).blur()
        }
      }}
    />
  )
}

function LabelsEditor({ labels, readOnly, onChange }: { labels: string[]; readOnly: boolean; onChange(labels: string[]): void }) {
  const [draft, setDraft] = useState('')
  const files = useVault((s) => s.files)
  const known = useMemo(() => [...new Set(ticketsFromFiles(files.values(), { includeArchived: true }).flatMap((t) => t.labels))].sort(), [files])
  const add = () => {
    const l = draft.trim().replace(/^#/, '').replace(/\s+/g, '-')
    setDraft('')
    if (l && !labels.includes(l)) onChange([...labels, l])
  }
  return (
    <div className="flex flex-wrap items-center gap-1 px-1">
      {labels.map((l) => (
        <LabelBadge key={l} label={l} onRemove={readOnly ? undefined : () => onChange(labels.filter((x) => x !== l))} />
      ))}
      {!readOnly && (
        <>
          <input
            list="known-labels"
            className="h-6 min-w-16 flex-1 rounded bg-transparent px-1 text-xs outline-none placeholder:text-subtle-foreground focus:bg-accent"
            placeholder="Add label"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={add}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault()
                add()
              }
              if (e.key === 'Backspace' && !draft && labels.length) onChange(labels.slice(0, -1))
            }}
          />
          <datalist id="known-labels">
            {known.filter((k) => !labels.includes(k)).map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>
        </>
      )}
    </div>
  )
}

function LinkedNotes({ path }: { path: string }) {
  const graph = useLinkGraph()
  const files = useVault((s) => s.files)
  const open = useOpenLink(path)
  const items = useMemo(() => {
    const out = new Map<string, 'out' | 'in' | 'both'>()
    for (const { resolved } of graph.outgoing(path)) if (resolved && files.get(resolved)?.kind !== 'attachment') out.set(resolved, 'out')
    for (const { from } of graph.backlinks(path)) out.set(from, out.has(from) ? 'both' : 'in')
    return [...out]
  }, [graph, files, path])

  return (
    <div className="mb-5 border-t pt-4">
      <SideLabel>Linked · {items.length}</SideLabel>
      {items.length === 0 && <p className="text-xs text-subtle-foreground">Type [[ in the description to link a note.</p>}
      {items.map(([p, dir]) => {
        const f = files.get(p)
        return (
          <button key={p} className="-mx-2 flex h-7 w-[calc(100%+16px)] items-center gap-2 rounded-md px-2 text-left text-muted-foreground hover:bg-accent hover:text-foreground" onClick={() => void open(graph.resolver.linkText(p), { newTab: false })}>
            {f?.kind === 'ticket' ? <Kanban className="size-3.5 shrink-0" /> : <FileText className="size-3.5 shrink-0" />}
            <span className="truncate">{f?.kind === 'ticket' ? `${f.frontmatter.key} ${f.title}` : f?.title}</span>
            <span className="ml-auto shrink-0 text-[10px] text-subtle-foreground">{dir === 'in' ? 'links here' : dir === 'both' ? '↔' : ''}</span>
          </button>
        )
      })}
    </div>
  )
}

function Attachments({ path }: { path: string }) {
  const graph = useLinkGraph()
  const files = useVault((s) => s.files)
  const attachments = useMemo(
    () => [...new Set(graph.outgoing(path).map((o) => o.resolved).filter((p): p is string => !!p && files.get(p)?.kind === 'attachment'))],
    [graph, files, path],
  )
  return (
    <div className="border-t pt-4">
      <SideLabel>Attachments · {attachments.length}</SideLabel>
      {attachments.map((p) => {
        const f = files.get(p)!
        return (
          <button
            key={p}
            className="mb-1.5 flex w-full items-center gap-2.5 rounded-md border px-2 py-1.5 text-left hover:border-border-strong hover:bg-accent"
            onClick={() => void attachmentUrl(p).then((url) => url && window.open(url, '_blank', 'noopener'))}
          >
            <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0">
              <span className="block truncate">{basename(p)}</span>
              <span className="block text-[11px] text-subtle-foreground">{formatBytes(f.size)}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
