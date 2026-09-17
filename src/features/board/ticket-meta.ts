export const TICKET_STATUSES = ['todo', 'in-progress', 'done'] as const
export type TicketStatus = (typeof TICKET_STATUSES)[number]

export const STATUS_LABEL: Record<TicketStatus, string> = {
  todo: 'Todo',
  'in-progress': 'In Progress',
  done: 'Done',
}

export const PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const
export type Priority = (typeof PRIORITIES)[number]

export const PRIORITY_LABEL: Record<Priority, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export function toStatus(value: unknown): TicketStatus {
  if (value === 'doing' || value === 'in progress') return 'in-progress'
  return TICKET_STATUSES.includes(value as TicketStatus) ? (value as TicketStatus) : 'todo'
}

export function toPriority(value: unknown): Priority {
  if (value === 'med') return 'medium'
  return PRIORITIES.includes(value as Priority) ? (value as Priority) : 'medium'
}

export function statusLabel(value: unknown): string {
  return STATUS_LABEL[toStatus(value)]
}
