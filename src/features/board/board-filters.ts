import { deadlineState } from '@/lib/dates'
import type { Ticket } from '@/services/tickets'
import type { Priority } from './ticket-meta'

export interface BoardFilters {
  text: string
  labels: string[]
  priorities: Priority[]
  due: 'all' | 'week' | 'overdue'
}

export const EMPTY_FILTERS: BoardFilters = { text: '', labels: [], priorities: [], due: 'all' }

export function isFiltering(f: BoardFilters) {
  return !!f.text.trim() || f.labels.length > 0 || f.priorities.length > 0 || f.due !== 'all'
}

export function matchesFilters(t: Ticket, f: BoardFilters, today = new Date()): boolean {
  const q = f.text.trim().toLowerCase()
  if (q && !t.title.toLowerCase().includes(q) && !t.key.toLowerCase().includes(q) && !t.labels.some((l) => l.toLowerCase().includes(q))) return false
  if (f.labels.length && !f.labels.some((l) => t.labels.includes(l))) return false
  if (f.priorities.length && !f.priorities.includes(t.priority)) return false
  if (f.due !== 'all') {
    const state = deadlineState(t.deadline, today)
    if (!state || t.status === 'done') return false
    if (f.due === 'overdue' && state !== 'overdue') return false
    if (f.due === 'week') {
      const days = t.deadline ? (new Date(t.deadline).getTime() - today.getTime()) / 86_400_000 : Infinity
      if (state !== 'overdue' && days > 7) return false
    }
  }
  return true
}
