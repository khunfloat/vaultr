/** Accept what people type or paste ("jira.corp/x", "https://…"); return a safe http(s) URL or null. */
export function normalizeUrl(input: string): string | null {
  const raw = input.trim()
  if (!raw || /\s/.test(raw)) return null
  // "host:3000" is a port, not a scheme.
  const withScheme = /^[a-z][a-z0-9+.-]*:(?!\d)/i.test(raw) ? raw : `https://${raw.replace(/^\/+/, '')}`
  try {
    const url = new URL(withScheme)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (!url.hostname.includes('.') && url.hostname !== 'localhost' && !/^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)) {
      // Single-label intranet hosts (e.g. "wiki") are valid only with an explicit scheme.
      if (!/^https?:\/\//i.test(raw)) return null
    }
    return url.href
  } catch {
    return null
  }
}

export function isWebUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value)
}

/** Short chip label: host without "www." plus a trimmed path, e.g. "jira.corp.local/browse/SSO-12". */
export function linkLabel(href: string, max = 48): string {
  try {
    const url = new URL(href)
    const host = url.hostname.replace(/^www\./, '')
    const rest = decodeURIComponent(url.pathname + url.search).replace(/\/$/, '')
    const label = host + (rest === '' ? '' : rest)
    return label.length > max ? `${label.slice(0, max - 1)}…` : label
  } catch {
    return href
  }
}
