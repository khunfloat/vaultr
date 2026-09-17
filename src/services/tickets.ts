import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing'
import { type Priority, type TicketStatus, toPriority, toStatus } from '@/features/board/ticket-meta'
import type { IndexedFile } from '@/index/types'
import { frontmatterTags } from '@/markdown/extract'
import { parseMarkdown, stringifyMarkdown, updateFrontmatter } from '@/markdown/frontmatter'
import { nowIso, parseDate } from '@/lib/dates'
import { VAULT_DIRS, writeVaultConfig } from '@/vault/config'
import { isInside, joinPath, stem } from '@/vault/paths'
import { useVault } from '@/vault/vault-store'
import { ReadOnlyError } from './errors'
import { movePath, readFile, trashPath, uniquePath, writeFile } from './vault-ops'

export const ARCHIVE_DIR = `${VAULT_DIRS.tickets}/archive`

export interface Ticket {
  path: string
  key: string
  number: number
  title: string
  status: TicketStatus
  priority: Priority
  deadline: string | null
  labels: string[]
  order: string
  created: string | null
  updated: string | null
  done: string | null
  archived: boolean
  tasks: { done: number; total: number }
  linkCount: number
  attachmentCount: number
  mtime: number
  frontmatterError: string | null
}

export function toTicket(file: IndexedFile): Ticket {
  const fm = file.frontmatter
  const key = typeof fm.key === 'string' && fm.key ? fm.key : stem(file.path)
  const str = (v: unknown) => (typeof v === 'string' && v ? v : v instanceof Date ? v.toISOString() : null)
  return {
    path: file.path,
    key,
    number: keyNumber(key),
    title: typeof fm.title === 'string' && fm.title ? fm.title : file.title,
    status: toStatus(fm.status),
    priority: toPriority(fm.priority),
    deadline: parseDate(str(fm.deadline)) ? str(fm.deadline) : null,
    labels: frontmatterTags(fm.labels),
    order: typeof fm.order === 'string' ? fm.order : fm.order != null ? String(fm.order) : '',
    created: str(fm.created),
    updated: str(fm.updated),
    done: str(fm.done),
    archived: isInside(file.path, ARCHIVE_DIR),
    tasks: file.tasks,
    linkCount: file.links.filter((l) => !l.embed).length,
    attachmentCount: file.links.filter((l) => l.embed).length,
    mtime: file.mtime,
    frontmatterError: file.frontmatterError,
  }
}

export function keyNumber(key: string): number {
  const m = /-(\d+)$/.exec(key)
  return m ? Number(m[1]) : 0
}

/** Manual order first (fractional index strings compare by code unit), then key number. */
export function compareTickets(a: Ticket, b: Ticket): number {
  if (a.order !== b.order) {
    if (!a.order) return 1
    if (!b.order) return -1
    return a.order < b.order ? -1 : 1
  }
  return a.number - b.number
}

export function ticketsFromFiles(files: Iterable<IndexedFile>, { includeArchived = false } = {}): Ticket[] {
  const out: Ticket[] = []
  for (const f of files) if (f.kind === 'ticket') out.push(toTicket(f))
  return (includeArchived ? out : out.filter((t) => !t.archived)).sort(compareTickets)
}

function writable() {
  const s = useVault.getState()
  if (s.status !== 'ready' || !s.config) throw new ReadOnlyError()
  return { ...s, config: s.config }
}

function isValidOrderKey(key: string | null): boolean {
  if (key === null) return true
  try {
    generateKeyBetween(key, null)
    return true
  } catch {
    return false
  }
}

/** Order key between two neighbours, or null when neighbours are invalid/equal and the column needs rebalancing. */
export function orderBetween(before: string | null, after: string | null): string | null {
  if (!isValidOrderKey(before) || !isValidOrderKey(after)) return null
  if (before !== null && after !== null && before >= after) return null
  try {
    return generateKeyBetween(before, after)
  } catch {
    return null
  }
}

export async function createTicket(input: { title: string; status?: TicketStatus; priority?: Priority; deadline?: string | null; body?: string }): Promise<Ticket> {
  const { config, files, setConfig, fs } = writable()
  const tickets = ticketsFromFiles(files.values(), { includeArchived: true })
  const number = Math.max(config.nextTicketNumber, ...tickets.filter((t) => t.key.startsWith(config.ticketPrefix + '-')).map((t) => t.number + 1))
  const key = `${config.ticketPrefix}-${number}`
  const status = input.status ?? 'todo'

  const column = tickets.filter((t) => !t.archived && t.status === status)
  const last = column[column.length - 1]?.order ?? null
  const order = orderBetween(last, null) ?? generateKeyBetween(null, null)
  const now = nowIso()

  const text = stringifyMarkdown(
    {
      key,
      title: input.title.trim() || 'Untitled',
      status,
      priority: input.priority ?? 'medium',
      ...(input.deadline ? { deadline: input.deadline } : {}),
      labels: [],
      order,
      created: now,
      updated: now,
    },
    input.body ?? '',
  )
  const path = await uniquePath(joinPath(VAULT_DIRS.tickets, `${key}.md`))
  await writeFile(path, text)

  const next = { ...config, nextTicketNumber: number + 1 }
  if (fs) await writeVaultConfig(fs, next)
  setConfig(next)
  return toTicket(useVault.getState().files.get(path)!)
}

export type TicketPatch = Partial<{
  title: string
  status: TicketStatus
  priority: Priority
  deadline: string | null
  labels: string[]
  order: string
}>

/** Frontmatter changes for a ticket patch: bumps `updated`, maintains `done`, drops empty deadline. */
export function ticketFrontmatterPatch(currentStatus: unknown, patch: TicketPatch): Record<string, unknown> {
  const fm: Record<string, unknown> = { ...patch, updated: nowIso() }
  if ('deadline' in patch) fm.deadline = patch.deadline || undefined
  if (patch.status) {
    const wasDone = toStatus(currentStatus) === 'done'
    if (patch.status === 'done' && !wasDone) fm.done = nowIso()
    if (patch.status !== 'done') fm.done = undefined
  }
  return fm
}

export async function updateTicket(path: string, patch: TicketPatch): Promise<void> {
  writable()
  // Merge onto whatever is on disk now; expectedMtime guards against a write racing in between.
  const { text, mtime } = await readFile(path)
  const fm = ticketFrontmatterPatch(parseMarkdown(text).data.status, patch)
  await writeFile(path, updateFrontmatter(text, fm), { expectedMtime: mtime })
}

/**
 * Move a ticket to `status`, placed between the tickets at `beforePath` and `afterPath` (either may be null).
 * Rebalances the whole column when existing order keys can't produce a key in between.
 */
export async function moveTicket(path: string, status: TicketStatus, beforePath: string | null, afterPath: string | null): Promise<void> {
  const { files } = writable()
  const all = ticketsFromFiles(files.values())
  const byPath = new Map(all.map((t) => [t.path, t]))
  const before = beforePath ? (byPath.get(beforePath)?.order ?? null) : null
  const after = afterPath ? (byPath.get(afterPath)?.order ?? null) : null

  const order = orderBetween(before || null, after || null)
  if (order !== null) {
    await updateTicket(path, { status, order })
    return
  }

  const column = all.filter((t) => t.status === status && t.path !== path)
  const insertAt = afterPath ? column.findIndex((t) => t.path === afterPath) : column.length
  column.splice(insertAt < 0 ? column.length : insertAt, 0, byPath.get(path)!)
  const keys = generateNKeysBetween(null, null, column.length)
  for (const [i, t] of column.entries()) {
    if (t.path === path) await updateTicket(t.path, { status, order: keys[i] })
    else if (t.order !== keys[i]) await updateTicket(t.path, { order: keys[i] })
  }
}

export async function deleteTicket(path: string): Promise<void> {
  await trashPath(path)
}

/** Move done tickets older than `days` into tickets/archive/. Returns how many were archived. */
export async function archiveDoneTickets(days = 30, now = new Date()): Promise<number> {
  const { files } = writable()
  const cutoff = now.getTime() - days * 86_400_000
  const stale = ticketsFromFiles(files.values()).filter((t) => {
    if (t.status !== 'done') return false
    const doneAt = parseDate(t.done ?? t.updated)
    return doneAt !== null && doneAt.getTime() < cutoff
  })
  for (const t of stale) await movePath(t.path, await uniquePath(joinPath(ARCHIVE_DIR, `${t.key}.md`)))
  return stale.length
}
