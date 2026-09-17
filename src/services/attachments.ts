import { format } from 'date-fns'
import { VAULT_DIRS } from '@/vault/config'
import { extname, joinPath, stem } from '@/vault/paths'
import { useVault } from '@/vault/vault-store'
import { uniquePath, writeBinary } from './vault-ops'

const MIME_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
}

export const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'])

export function isImagePath(path: string) {
  return IMAGE_EXTS.has(extname(path))
}

export function slugify(name: string): string {
  return (
    name
      .normalize('NFC')
      .replace(/[\\/:*?"<>|#^[\]]+/g, ' ')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'file'
  )
}

/** Save a pasted/dropped file into attachments/ and return its vault path. */
export async function saveAttachment(file: Blob & { name?: string }, now = new Date()): Promise<string> {
  const name = file.name && file.name !== 'image.png' ? file.name : ''
  const ext = (name && extname(name)) || MIME_EXT[file.type] || '.bin'
  const base = slugify(name ? stem(name) : file.type.startsWith('image/') ? 'pasted-image' : 'file')
  const path = await uniquePath(joinPath(VAULT_DIRS.attachments, `${format(now, 'yyyyMMdd-HHmmss')}-${base}${ext}`))
  await writeBinary(path, file)
  return path
}

const urlCache = new Map<string, { mtime: number; url: string }>()

/** Object URL for a vault file, cached per mtime. Returns null if the file is missing. */
export async function attachmentUrl(path: string): Promise<string | null> {
  const { fs, files } = useVault.getState()
  const file = files.get(path)
  if (!fs || !file) return null
  const cached = urlCache.get(path)
  if (cached && cached.mtime === file.mtime) return cached.url
  try {
    const blob = await fs.readBlob(path)
    const typed = extname(path) === '.svg' ? new Blob([blob], { type: 'image/svg+xml' }) : blob
    const url = URL.createObjectURL(typed)
    if (cached) URL.revokeObjectURL(cached.url)
    urlCache.set(path, { mtime: file.mtime, url })
    return url
  } catch {
    return null
  }
}
