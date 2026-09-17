import { differenceInCalendarDays, format, isValid, parseISO } from 'date-fns'

/** ISO timestamp with local offset, e.g. 2026-09-17T10:40:00+07:00 */
export function nowIso(date = new Date()): string {
  return format(date, "yyyy-MM-dd'T'HH:mm:ssxxx")
}

export function todayIsoDate(date = new Date()): string {
  return format(date, 'yyyy-MM-dd')
}

export function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null
  const d = parseISO(value)
  return isValid(d) ? d : null
}

/** `17 Sep 2026` */
export function formatDate(value: unknown): string {
  const d = parseDate(value)
  return d ? format(d, 'd MMM yyyy') : ''
}

export type DeadlineState = 'overdue' | 'today' | 'soon' | 'later'

export function deadlineState(deadline: string | null, today = new Date()): DeadlineState | null {
  const d = parseDate(deadline)
  if (!d) return null
  const days = differenceInCalendarDays(d, today)
  if (days < 0) return 'overdue'
  if (days === 0) return 'today'
  if (days <= 2) return 'soon'
  return 'later'
}

/** Short label for cards: "Overdue · 15 Sep", "Today", "Tomorrow", "in 2 days", "30 Sep". */
export function deadlineLabel(deadline: string | null, today = new Date()): string {
  const d = parseDate(deadline)
  if (!d) return ''
  const days = differenceInCalendarDays(d, today)
  if (days < 0) return `Overdue · ${format(d, 'd MMM')}`
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days <= 6) return `in ${days} days`
  return format(d, d.getFullYear() === today.getFullYear() ? 'd MMM' : 'd MMM yyyy')
}
