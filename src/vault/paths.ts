// Vault paths are POSIX-style, relative to the vault root, with no leading or trailing slash.

export function normalizePath(path: string): string {
  const out: string[] = []
  for (const part of path.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue
    if (part === '..') {
      if (!out.length) throw new Error(`Path escapes vault root: ${path}`)
      out.pop()
      continue
    }
    out.push(part)
  }
  return out.join('/')
}

export function splitPath(path: string): string[] {
  const p = normalizePath(path)
  return p ? p.split('/') : []
}

export function joinPath(...parts: string[]): string {
  return normalizePath(parts.filter(Boolean).join('/'))
}

export function dirname(path: string): string {
  const parts = splitPath(path)
  parts.pop()
  return parts.join('/')
}

export function basename(path: string): string {
  const parts = splitPath(path)
  return parts[parts.length - 1] ?? ''
}

export function extname(path: string): string {
  const name = basename(path)
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(i).toLowerCase() : ''
}

/** File name without extension: `notes/Login flow.md` → `Login flow`. */
export function stem(path: string): string {
  const name = basename(path)
  const ext = extname(name)
  return ext ? name.slice(0, -ext.length) : name
}

export function isInside(path: string, dir: string): boolean {
  const p = normalizePath(path)
  const d = normalizePath(dir)
  return d === '' || p === d || p.startsWith(d + '/')
}
