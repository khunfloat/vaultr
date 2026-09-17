import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Archive, Check, Filter, Kanban, MoreHorizontal, Plus, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { PageHeader } from '@/app/PageHeader'
import { useUi } from '@/app/ui-store'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { useStoredState } from '@/lib/use-stored-state'
import { cn } from '@/lib/utils'
import { routes } from '@/lib/routes'
import { archiveDoneTickets, moveTicket, ticketsFromFiles, type Ticket } from '@/services/tickets'
import { useVault } from '@/vault/vault-store'
import { EMPTY_FILTERS, isFiltering, matchesFilters, type BoardFilters } from './board-filters'
import { NewTicketDialog } from './NewTicketDialog'
import { StatusIcon, LabelBadge, PriorityIcon } from './TicketBadges'
import { SortableTicketCard, TicketCardView } from './TicketCard'
import { TicketDialog } from './TicketDialog'
import { PRIORITIES, PRIORITY_LABEL, STATUS_LABEL, TICKET_STATUSES, type TicketStatus } from './ticket-meta'

type Columns = Record<TicketStatus, string[]>

export function BoardPage() {
  const files = useVault((s) => s.files)
  const readOnly = useVault((s) => s.status !== 'ready')
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [filters, setFilters] = useStoredState<BoardFilters>('vaultr:board-filters', EMPTY_FILTERS)
  const newFor = useUi((s) => s.newTicket)
  const setNewFor = useUi((s) => s.setNewTicket)

  const tickets = useMemo(() => ticketsFromFiles(files.values()), [files])
  const byPath = useMemo(() => new Map(tickets.map((t) => [t.path, t])), [tickets])
  const byKey = useMemo(() => new Map(tickets.map((t) => [t.key.toLowerCase(), t])), [tickets])
  const allLabels = useMemo(() => [...new Set(tickets.flatMap((t) => t.labels))].sort(), [tickets])

  const derived = useMemo<Columns>(() => {
    const cols: Columns = { todo: [], 'in-progress': [], done: [] }
    for (const t of tickets) if (matchesFilters(t, filters)) cols[t.status].push(t.path)
    return cols
  }, [tickets, filters])

  // While dragging (and until the write lands) show the optimistic layout. It is tied to the
  // snapshot it was made from, so it disappears as soon as the index reflects the write.
  const [optimistic, setOptimistic] = useState<{ base: Columns; cols: Columns } | null>(null)
  const override = optimistic?.base === derived ? optimistic.cols : null
  const setOverride = (update: Columns | null | ((prev: Columns | null) => Columns | null)) =>
    setOptimistic((prev) => {
      const current = prev?.base === derived ? prev.cols : null
      const next = typeof update === 'function' ? update(current) : update
      return next ? { base: derived, cols: next } : null
    })
  const [activePath, setActivePath] = useState<string | null>(null)
  const columns = override ?? derived

  const openKey = params.get('ticket')
  const openTicket = openKey ? (byKey.get(openKey.toLowerCase()) ?? null) : null
  const openTicketPath = openTicket?.path ?? (openKey ? `missing:${openKey}` : null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))

  const findColumn = (id: string, cols: Columns): TicketStatus | null => {
    if (id.startsWith('col:')) return id.slice(4) as TicketStatus
    return (Object.keys(cols) as TicketStatus[]).find((s) => cols[s].includes(id)) ?? null
  }

  const onDragStart = (e: DragStartEvent) => {
    setActivePath(String(e.active.id))
    setOverride(derived)
  }

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return
    setOverride((prev) => {
      const cols = prev ?? derived
      const from = findColumn(String(active.id), cols)
      const to = findColumn(String(over.id), cols)
      if (!from || !to || from === to) return prev
      const moving = String(active.id)
      const target = cols[to]
      const overIndex = over.id.toString().startsWith('col:') ? target.length : target.indexOf(String(over.id))
      return {
        ...cols,
        [from]: cols[from].filter((p) => p !== moving),
        [to]: [...target.slice(0, overIndex), moving, ...target.slice(overIndex)],
      }
    })
  }

  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    setActivePath(null)
    const cols = override ?? derived
    if (!over) return setOverride(null)
    const moving = String(active.id)
    const status = findColumn(moving, cols)
    if (!status) return setOverride(null)

    let list = cols[status]
    const overId = String(over.id)
    if (!overId.startsWith('col:') && overId !== moving) {
      const from = list.indexOf(moving)
      const to = list.indexOf(overId)
      list = [...list]
      list.splice(from, 1)
      list.splice(to, 0, moving)
      setOverride({ ...cols, [status]: list })
    }

    const i = list.indexOf(moving)
    const before = list[i - 1] ?? null
    const after = list[i + 1] ?? null
    const t = byPath.get(moving)
    if (t && t.status === status && derived[status].indexOf(moving) === i && !isFiltering(filters)) return setOverride(null)
    try {
      await moveTicket(moving, status, before, after)
    } catch (err) {
      setOverride(null)
      toast.error(err instanceof Error ? err.message : 'Could not move ticket')
    }
  }

  const archive = async () => {
    try {
      const n = await archiveDoneTickets(30)
      toast.success(n ? `Archived ${n} ticket${n > 1 ? 's' : ''} to tickets/archive` : 'Nothing older than 30 days')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Archive failed')
    }
  }

  const setTicketParam = (key: string | null) => {
    const next = new URLSearchParams(params)
    if (key) next.set('ticket', key)
    else next.delete('ticket')
    setParams(next)
  }

  const overdue = tickets.filter((t) => t.status !== 'done' && matchesFilters(t, { ...EMPTY_FILTERS, due: 'overdue' })).length
  const dueWeek = tickets.filter((t) => t.status !== 'done' && matchesFilters(t, { ...EMPTY_FILTERS, due: 'week' })).length
  const activeTicket = activePath ? byPath.get(activePath) : null

  return (
    <>
      <PageHeader
        actions={
          <>
            <div className="relative w-64">
              <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-subtle-foreground" />
              <Input className="h-8 pl-8" placeholder="Filter tickets…" value={filters.text} onChange={(e) => setFilters({ ...filters, text: e.target.value })} />
            </div>
            <Button onClick={() => setNewFor('todo')} disabled={readOnly}>
              <Plus /> New ticket
            </Button>
          </>
        }
      >
        <Kanban className="size-4" /> <b>Board</b>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className={cn(filters.labels.length && 'border-ring')}>
              <Filter /> Labels{filters.labels.length ? ` · ${filters.labels.length}` : ''}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-80 overflow-auto">
            {allLabels.length === 0 && <DropdownMenuLabel className="text-xs text-subtle-foreground">No labels yet</DropdownMenuLabel>}
            {allLabels.map((l) => (
              <DropdownMenuCheckboxItem
                key={l}
                checked={filters.labels.includes(l)}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={(on) => setFilters({ ...filters, labels: on ? [...filters.labels, l] : filters.labels.filter((x) => x !== l) })}
              >
                <LabelBadge label={l} />
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className={cn(filters.priorities.length && 'border-ring')}>
              <PriorityIcon priority="high" /> Priority{filters.priorities.length ? ` · ${filters.priorities.length}` : ''}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {PRIORITIES.map((p) => (
              <DropdownMenuCheckboxItem
                key={p}
                checked={filters.priorities.includes(p)}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={(on) => setFilters({ ...filters, priorities: on ? [...filters.priorities, p] : filters.priorities.filter((x) => x !== p) })}
              >
                <PriorityIcon priority={p} /> {PRIORITY_LABEL[p]}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="mx-1 h-4 w-px bg-border-strong" />
        <FilterChip active={filters.due === 'week'} className="text-status-amber" onClick={() => setFilters({ ...filters, due: filters.due === 'week' ? 'all' : 'week' })}>
          Due this week · {dueWeek}
        </FilterChip>
        <FilterChip active={filters.due === 'overdue'} className="text-status-red" onClick={() => setFilters({ ...filters, due: filters.due === 'overdue' ? 'all' : 'overdue' })}>
          Overdue · {overdue}
        </FilterChip>
        {isFiltering(filters) && (
          <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
            <X /> Clear filters
          </Button>
        )}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={(e) => void onDragEnd(e)} onDragCancel={() => (setActivePath(null), setOverride(null))}>
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-3 overflow-auto px-4 pb-4" style={{ gridTemplateColumns: 'repeat(3, minmax(280px, 1fr))' }}>
          {TICKET_STATUSES.map((status) => (
            <Column
              key={status}
              status={status}
              paths={columns[status]}
              byPath={byPath}
              readOnly={readOnly}
              onOpen={(t) => setTicketParam(t.key)}
              onNew={() => setNewFor(status)}
              menu={
                status === 'done' ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-xs" aria-label="Done column actions">
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem disabled={readOnly} onSelect={() => void archive()}>
                        <Archive /> Archive done older than 30 days
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs font-normal text-subtle-foreground">Archived tickets stay searchable</DropdownMenuLabel>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null
              }
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>{activeTicket ? <TicketCardView ticket={activeTicket} overlay /> : null}</DragOverlay>
      </DndContext>

      <NewTicketDialog open={newFor !== null} onOpenChange={(o) => !o && setNewFor(null)} defaultStatus={newFor ?? 'todo'} onCreated={(t) => setTicketParam(t.key)} />
      <TicketDialog
        path={openTicketPath?.startsWith('missing:') ? '__missing__' : openTicketPath}
        onClose={() => {
          setTicketParam(null)
          if (!openTicket && openKey) navigate(routes.board(), { replace: true })
        }}
      />
    </>
  )
}

function FilterChip({ active, className, onClick, children }: { active: boolean; className?: string; onClick(): void; children: React.ReactNode }) {
  return (
    <button
      className={cn('inline-flex h-6 items-center gap-1 rounded-full border border-transparent px-2.5 text-[11px] font-medium', active ? 'border-current bg-current/15' : 'bg-white/5 hover:bg-white/10', className)}
      onClick={onClick}
    >
      {active && <Check className="size-3" />}
      {children}
    </button>
  )
}

function Column({
  status,
  paths,
  byPath,
  readOnly,
  onOpen,
  onNew,
  menu,
}: {
  status: TicketStatus
  paths: string[]
  byPath: Map<string, Ticket>
  readOnly: boolean
  onOpen(t: Ticket): void
  onNew(): void
  menu: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${status}`, data: { type: 'column' } })
  return (
    <section className={cn('flex min-h-0 flex-col rounded-[10px] border bg-white/[0.015]', isOver && 'border-border-strong')} aria-label={STATUS_LABEL[status]}>
      <div className="flex items-center gap-2 py-2.5 pr-2 pl-3 font-medium">
        <StatusIcon status={status} />
        {STATUS_LABEL[status]}
        <span className="font-normal text-subtle-foreground">{paths.length}</span>
        <div className="ml-auto flex items-center gap-0.5">
          {menu}
          {!readOnly && (
            <Button variant="ghost" size="icon-xs" onClick={onNew} aria-label={`New ${STATUS_LABEL[status]} ticket`}>
              <Plus />
            </Button>
          )}
        </div>
      </div>
      <SortableContext id={status} items={paths} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex min-h-24 flex-1 flex-col gap-2 overflow-auto px-2 pb-2">
          {paths.map((p) => {
            const t = byPath.get(p)
            return t ? <SortableTicketCard key={p} ticket={t} onOpen={() => onOpen(t)} disabled={readOnly} /> : null
          })}
          {status === 'todo' && !readOnly && (
            <Button variant="ghost" size="sm" className="justify-start text-subtle-foreground" onClick={onNew}>
              <Plus /> Add ticket
            </Button>
          )}
        </div>
      </SortableContext>
    </section>
  )
}
