import type { Ticket } from '@/services/tickets'
import { EMPTY_FILTERS, matchesFilters } from './board-filters'

const t = (over: Partial<Ticket>): Ticket =>
  ({ key: 'TD-1', title: 'Fix login', labels: [], priority: 'medium', deadline: null, status: 'todo', ...over }) as Ticket
const today = new Date('2026-09-17T09:00:00')

describe('board filters', () => {
  it('matches text on title, key and labels', () => {
    expect(matchesFilters(t({}), { ...EMPTY_FILTERS, text: 'login' }, today)).toBe(true)
    expect(matchesFilters(t({}), { ...EMPTY_FILTERS, text: 'td-1' }, today)).toBe(true)
    expect(matchesFilters(t({ labels: ['finance'] }), { ...EMPTY_FILTERS, text: 'fin' }, today)).toBe(true)
    expect(matchesFilters(t({}), { ...EMPTY_FILTERS, text: 'budget' }, today)).toBe(false)
  })

  it('filters by labels and priority', () => {
    expect(matchesFilters(t({ labels: ['bug'] }), { ...EMPTY_FILTERS, labels: ['bug', 'x'] }, today)).toBe(true)
    expect(matchesFilters(t({ labels: [] }), { ...EMPTY_FILTERS, labels: ['bug'] }, today)).toBe(false)
    expect(matchesFilters(t({ priority: 'high' }), { ...EMPTY_FILTERS, priorities: ['urgent'] }, today)).toBe(false)
  })

  it('filters by due window, ignoring done tickets', () => {
    const week = { ...EMPTY_FILTERS, due: 'week' as const }
    const overdue = { ...EMPTY_FILTERS, due: 'overdue' as const }
    expect(matchesFilters(t({ deadline: '2026-09-20' }), week, today)).toBe(true)
    expect(matchesFilters(t({ deadline: '2026-10-20' }), week, today)).toBe(false)
    expect(matchesFilters(t({ deadline: '2026-09-15' }), overdue, today)).toBe(true)
    expect(matchesFilters(t({ deadline: '2026-09-15', status: 'done' }), overdue, today)).toBe(false)
    expect(matchesFilters(t({}), week, today)).toBe(false)
  })
})
