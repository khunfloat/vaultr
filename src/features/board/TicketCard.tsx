import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Link2, ListChecks, Paperclip } from 'lucide-react'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils'
import type { Ticket } from '@/services/tickets'
import { DeadlineBadge, LabelBadge, PriorityIcon } from './TicketBadges'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  ticket: Ticket
  dragging?: boolean
  overlay?: boolean
}

export const TicketCardView = forwardRef<HTMLDivElement, CardProps>(function TicketCardView({ ticket: t, dragging, overlay, className, ...props }, ref) {
  const done = t.status === 'done'
  const hasMeta = t.deadline || t.labels.length || t.tasks.total || t.linkCount || t.attachmentCount
  return (
    <div
      ref={ref}
      data-ticket={t.key}
      className={cn(
        'flex cursor-grab flex-col gap-2 rounded-lg border bg-card px-3 py-2.5 text-left outline-none select-none hover:border-border-strong hover:bg-[#1a1a1a] focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing',
        dragging && 'opacity-40',
        overlay && 'rotate-2 border-ring shadow-2xl shadow-black/60',
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-1.5 text-[11px] text-subtle-foreground">
        <span className="font-mono">{t.key}</span>
        {t.frontmatterError && <span className="text-status-red">invalid frontmatter</span>}
        <PriorityIcon priority={t.priority} className="ml-auto" />
      </div>
      <div className={cn('leading-snug font-medium', done && 'text-muted-foreground line-through decoration-subtle-foreground')}>{t.title}</div>
      {hasMeta ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <DeadlineBadge deadline={t.deadline} done={done} />
          {t.labels.map((l) => (
            <LabelBadge key={l} label={l} />
          ))}
          <span className="ml-auto flex gap-2 text-[11px] text-subtle-foreground">
            {t.tasks.total > 0 && (
              <span className="flex items-center gap-0.5">
                <ListChecks className="size-3" /> {t.tasks.done}/{t.tasks.total}
              </span>
            )}
            {t.linkCount > 0 && (
              <span className="flex items-center gap-0.5">
                <Link2 className="size-3" /> {t.linkCount}
              </span>
            )}
            {t.attachmentCount > 0 && (
              <span className="flex items-center gap-0.5">
                <Paperclip className="size-3" /> {t.attachmentCount}
              </span>
            )}
          </span>
        </div>
      ) : null}
      {t.tasks.total > 0 && !done && (
        <div className="h-0.75 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-muted-foreground" style={{ width: `${(t.tasks.done / t.tasks.total) * 100}%` }} />
        </div>
      )}
    </div>
  )
})

export function SortableTicketCard({ ticket, onOpen, disabled }: { ticket: Ticket; onOpen(): void; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ticket.path,
    data: { type: 'ticket', status: ticket.status },
    disabled,
  })
  return (
    <TicketCardView
      ref={setNodeRef}
      ticket={ticket}
      dragging={isDragging}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen()
        listeners?.onKeyDown?.(e)
      }}
      {...attributes}
      {...Object.fromEntries(Object.entries(listeners ?? {}).filter(([k]) => k !== 'onKeyDown'))}
    />
  )
}
