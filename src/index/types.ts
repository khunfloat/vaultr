import type { FrontmatterData } from '@/markdown/frontmatter'
import type { Heading, WikiLink } from '@/markdown/extract'

export type FileKind = 'note' | 'ticket' | 'attachment' | 'other'

export interface IndexedFile {
  vaultId: string
  path: string
  kind: FileKind
  mtime: number
  size: number
  /** Markdown-only fields below; empty for attachments/other. */
  title: string
  frontmatter: FrontmatterData
  frontmatterError: string | null
  body: string
  links: WikiLink[]
  tags: string[]
  headings: Heading[]
  tasks: { done: number; total: number }
}
