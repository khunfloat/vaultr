/**
 * Hash-router paths. Notes under `notes/` map to `/notes/<rest>`; markdown files elsewhere in the
 * vault map to `/notes/~/<vault path>`.
 */
export const routes = {
  board: () => '/board',
  ticket: (key: string) => `/board?ticket=${encodeURIComponent(key)}`,
  notes: () => '/notes',
  note: (path: string) => {
    const rel = path.startsWith('notes/') ? path.slice('notes/'.length) : `~/${path}`
    return `/notes/${rel.split('/').map(encodeURIComponent).join('/')}`
  },
}

/** Inverse of routes.note for the decoded `*` splat param. */
export function notePathFromSplat(splat: string | undefined): string {
  if (!splat) return ''
  return splat.startsWith('~/') ? splat.slice(2) : `notes/${splat}`
}
