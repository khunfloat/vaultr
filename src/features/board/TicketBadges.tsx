import { AlertTriangle, ArrowDown, ArrowUp, CalendarDays, CheckCircle2, Circle, CircleDashed, Equal } from 'lucide-react'
import { deadlineLabel, deadlineState } from '@/lib/dates'
import { cn } from '@/lib/utils'
import type { Priority, TicketStatus } from './ticket-meta'

export function StatusIcon({ status, className }: { status: TicketStatus; className?: string }) {
  if (status === 'done') return <CheckCircle2 className={cn('size-4 text-status-green', className)} />
  if (status === 'in-progress') return <Circle className={cn('size-4 fill-status-blue/40 text-status-blue', className)} />
  return <CircleDashed className={cn('size-4 text-muted-foreground', className)} />
}

export function PriorityIcon({ priority, className }: { priority: Priority; className?: string }) {
  const cls = cn('size-3.5', className)
  if (priority === 'urgent') return <AlertTriangle className={cn(cls, 'text-status-red')} aria-label="Urgent" />
  if (priority === 'high') return <ArrowUp className={cn(cls, 'text-status-amber')} aria-label="High" />
  if (priority === 'low') return <ArrowDown className={cn(cls, 'text-subtle-foreground')} aria-label="Low" />
  return <Equal className={cn(cls, 'text-muted-foreground')} aria-label="Medium" />
}

const DEADLINE_STYLE = {
  overdue: 'bg-status-red/12 text-status-red',
  today: 'bg-status-amber/12 text-status-amber',
  soon: 'bg-status-amber/12 text-status-amber',
  later: 'border border-border text-muted-foreground',
} as const

export function DeadlineBadge({ deadline, done, long }: { deadline: string | null; done?: boolean; long?: boolean }) {
  const state = deadlineState(deadline)
  if (!state || !deadline) return null
  const style = done ? DEADLINE_STYLE.later : DEADLINE_STYLE[state]
  return (
    <span className={cn('inline-flex h-5 items-center gap-1 rounded-full px-2 text-[11px] font-medium whitespace-nowrap', style)}>
      <CalendarDays className="size-3" />
      {long ? deadline : done && state === 'overdue' ? deadline.slice(5) : deadlineLabel(deadline)}
    </span>
  )
}

const LABEL_COLORS = ['text-status-violet bg-status-violet/12', 'text-status-blue bg-status-blue/12', 'text-status-green bg-status-green/12', 'text-status-amber bg-status-amber/12', 'text-muted-foreground border border-border']

function labelColor(label: string) {
  let h = 0
  for (const c of label) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return LABEL_COLORS[h % LABEL_COLORS.length]
}

export function LabelBadge({ label, onRemove }: { label: string; onRemove?(): void }) {
  return (
    <span className={cn('inline-flex h-5 items-center gap-1 rounded-full px-2 text-[11px] font-medium whitespace-nowrap', labelColor(label))}>
      {label}
      {onRemove && (
        <button className="-mr-1 opacity-60 hover:opacity-100" onClick={onRemove} aria-label={`Remove ${label}`}>
          ×
        </button>
      )}
    </span>
  )
}
