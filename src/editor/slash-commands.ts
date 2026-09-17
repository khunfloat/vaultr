import { type Completion, type CompletionContext, type CompletionResult, startCompletion } from '@codemirror/autocomplete'
import { syntaxTree } from '@codemirror/language'
import type { EditorView } from '@codemirror/view'
import { format } from 'date-fns'
import type { EditorContextRef } from './link-context'

export interface SlashEdit {
  from: number
  to: number
  insert: string
  /** Cursor position relative to `from` after the edit. */
  cursor: number
}

type Kind =
  | { type: 'prefix'; prefix: string }
  | { type: 'block'; text: string; cursor: number }
  | { type: 'inline'; text: string; cursor: number }
  | { type: 'action'; run(view: EditorView, from: number, to: number, ctx: EditorContextRef): void }

export interface SlashCommand {
  id: string
  label: string
  hint: string
  icon: string
  section: 'Basic blocks' | 'Insert'
  aliases: string[]
  kind: Kind
}

const TABLE = '| Column 1 | Column 2 |\n| --- | --- |\n|  |  |'

export const SLASH_COMMANDS: SlashCommand[] = [
  { id: 'text', label: 'Text', hint: 'Plain paragraph', icon: 'T', section: 'Basic blocks', aliases: ['paragraph', 'p', 'ข้อความ'], kind: { type: 'prefix', prefix: '' } },
  { id: 'h1', label: 'Heading 1', hint: '#', icon: 'H1', section: 'Basic blocks', aliases: ['h1', 'title', 'หัวข้อ'], kind: { type: 'prefix', prefix: '# ' } },
  { id: 'h2', label: 'Heading 2', hint: '##', icon: 'H2', section: 'Basic blocks', aliases: ['h2', 'subtitle', 'หัวข้อ'], kind: { type: 'prefix', prefix: '## ' } },
  { id: 'h3', label: 'Heading 3', hint: '###', icon: 'H3', section: 'Basic blocks', aliases: ['h3', 'หัวข้อ'], kind: { type: 'prefix', prefix: '### ' } },
  { id: 'bullet', label: 'Bulleted list', hint: '-', icon: '•', section: 'Basic blocks', aliases: ['ul', 'list', 'bullet', 'รายการ'], kind: { type: 'prefix', prefix: '- ' } },
  { id: 'numbered', label: 'Numbered list', hint: '1.', icon: '1.', section: 'Basic blocks', aliases: ['ol', 'number', 'รายการ'], kind: { type: 'prefix', prefix: '1. ' } },
  { id: 'todo', label: 'To-do list', hint: '- [ ]', icon: '☐', section: 'Basic blocks', aliases: ['task', 'checkbox', 'check', 'งาน'], kind: { type: 'prefix', prefix: '- [ ] ' } },
  { id: 'quote', label: 'Quote', hint: '>', icon: '❝', section: 'Basic blocks', aliases: ['blockquote', 'คำพูด'], kind: { type: 'prefix', prefix: '> ' } },
  { id: 'callout', label: 'Callout', hint: '> [!note]', icon: '!', section: 'Basic blocks', aliases: ['note', 'info', 'warning', 'tip'], kind: { type: 'block', text: '> [!note]\n> ', cursor: 12 } },
  { id: 'code', label: 'Code block', hint: '```', icon: '</>', section: 'Basic blocks', aliases: ['code', 'snippet', 'pre', 'โค้ด'], kind: { type: 'block', text: '```\n\n```', cursor: 4 } },
  { id: 'table', label: 'Table', hint: '| |', icon: '⊞', section: 'Basic blocks', aliases: ['grid', 'ตาราง'], kind: { type: 'block', text: TABLE, cursor: 2 } },
  { id: 'divider', label: 'Divider', hint: '---', icon: '—', section: 'Basic blocks', aliases: ['hr', 'line', 'separator', 'เส้น'], kind: { type: 'block', text: '---\n', cursor: 4 } },
  {
    id: 'weblink',
    label: 'Link',
    hint: 'paste URL + Space',
    icon: '🌐',
    section: 'Insert',
    aliases: ['url', 'web', 'website', 'bookmark', 'http', 'เว็บ', 'ลิงก์'],
    // Leaves "/link " in place; pasting a URL and pressing Space turns it into a chip (see link-shortcut.ts).
    kind: { type: 'inline', text: '/link ', cursor: 6 },
  },
  {
    id: 'link',
    label: 'Link to note',
    hint: '[[',
    icon: '↗',
    section: 'Insert',
    aliases: ['wikilink', 'page', 'mention', 'ticket', 'โน้ต'],
    kind: {
      type: 'action',
      run(view, from, to) {
        view.dispatch({ changes: { from, to, insert: '[[]]' }, selection: { anchor: from + 2 } })
        startCompletion(view)
      },
    },
  },
  {
    id: 'image',
    label: 'Image or file',
    hint: 'Upload',
    icon: '🖼',
    section: 'Insert',
    aliases: ['picture', 'attachment', 'upload', 'file', 'รูป', 'ไฟล์'],
    kind: {
      type: 'action',
      run(view, from, to, ctx) {
        view.dispatch({ changes: { from, to, insert: '' }, selection: { anchor: from } })
        const input = document.createElement('input')
        input.type = 'file'
        input.multiple = true
        input.onchange = async () => {
          const links: string[] = []
          for (const file of input.files ?? []) links.push(`![[${await ctx.current.saveFile(file)}]]`)
          if (!links.length) return
          const pos = view.state.selection.main.from
          const text = links.join('\n')
          view.dispatch({ changes: { from: pos, insert: text }, selection: { anchor: pos + text.length } })
          view.focus()
        }
        input.click()
      },
    },
  },
  { id: 'date', label: 'Today’s date', hint: 'yyyy-mm-dd', icon: '📅', section: 'Insert', aliases: ['today', 'now', 'วันนี้'], kind: { type: 'inline', text: '', cursor: 0 } },
  { id: 'highlight', label: 'Highlight', hint: '==text==', icon: 'H̲', section: 'Insert', aliases: ['mark', 'ไฮไลต์'], kind: { type: 'inline', text: '====', cursor: 2 } },
]

/**
 * Compute the edit for a block/prefix/inline command replacing the `/query` at [from, to).
 * Blocks go on their own line: at an empty line they replace it, mid-line they start a new line.
 */
const BLOCK_MARKER = /^(\s*)(?:#{1,6}\s+|[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+[.)]\s+|>\s?)?/

export function slashEdit(doc: string, from: number, to: number, kind: Exclude<Kind, { type: 'action' }>, today = new Date()): SlashEdit {
  const lineStart = doc.lastIndexOf('\n', from - 1) + 1
  const lineEndIdx = doc.indexOf('\n', to)
  const lineEnd = lineEndIdx < 0 ? doc.length : lineEndIdx
  const before = doc.slice(lineStart, from)
  const after = doc.slice(to, lineEnd)
  const [marker, indent] = BLOCK_MARKER.exec(before) as unknown as [string, string]
  // "/cmd" typed right after a block marker (e.g. "> /code") converts that line rather than nesting.
  const atLineStart = before.slice(marker.length).trim() === ''

  if (kind.type === 'inline') {
    const text = kind.text || format(today, 'yyyy-MM-dd')
    return { from, to, insert: text, cursor: kind.text ? kind.cursor : text.length }
  }

  if (kind.type === 'prefix') {
    if (atLineStart) {
      const rest = after.replace(BLOCK_MARKER, '')
      return { from: lineStart, to: lineEnd, insert: indent + kind.prefix + rest, cursor: indent.length + kind.prefix.length }
    }
    return { from, to, insert: `\n${indent}${kind.prefix}`, cursor: 1 + indent.length + kind.prefix.length }
  }

  const lead = atLineStart ? '' : '\n'
  const trail = after.trim() ? '\n' : ''
  const start = atLineStart ? lineStart : from
  const text = lead + kind.text + trail
  return { from: start, to, insert: text, cursor: lead.length + kind.cursor }
}

function matches(cmd: SlashCommand, query: string) {
  if (!query) return 0
  const q = query.toLowerCase()
  const label = cmd.label.toLowerCase()
  if (label.startsWith(q)) return 3
  if (cmd.aliases.some((a) => a.toLowerCase().startsWith(q))) return 2
  if (label.includes(q) || label.split(/\s+/).some((w) => w.startsWith(q))) return 1
  return -1
}

export function slashSource(ctx: EditorContextRef) {
  return (context: CompletionContext): CompletionResult | null => {
    const match = context.matchBefore(/(?:^|\s)\/[\p{L}\p{N}-]*$/u)
    if (!match) return null
    const slash = match.from + match.text.indexOf('/')
    const node = syntaxTree(context.state).resolveInner(slash, -1)
    for (let n: typeof node | null = node; n; n = n.parent) if (/Code|HTML|URL/.test(n.name)) return null

    const query = context.state.sliceDoc(slash + 1, context.pos)
    const ranked = SLASH_COMMANDS.map((cmd, i) => ({ cmd, score: matches(cmd, query), i }))
      .filter((r) => r.score >= 0)
      .sort((a, b) => b.score - a.score || a.i - b.i)
    if (!ranked.length) return null

    const options: Completion[] = ranked.map(({ cmd }, i) => ({
      label: cmd.label,
      detail: cmd.hint,
      type: `slash-${cmd.id}`,
      section: query ? undefined : { name: cmd.section, rank: cmd.section === 'Basic blocks' ? 0 : 1 },
      boost: ranked.length - i,
      apply(view, _c, _from, to) {
        if (cmd.kind.type === 'action') return cmd.kind.run(view, slash, to, ctx)
        const edit = slashEdit(view.state.doc.toString(), slash, to, cmd.kind)
        view.dispatch({ changes: { from: edit.from, to: edit.to, insert: edit.insert }, selection: { anchor: edit.from + edit.cursor }, scrollIntoView: true })
      },
    }))

    return { from: slash, options, filter: false }
  }
}

/** Icon column for slash-command rows in the completion list. */
export const slashIcons = {
  render(completion: Completion) {
    const id = completion.type?.startsWith('slash-') ? completion.type.slice(6) : null
    if (!id) return null
    const cmd = SLASH_COMMANDS.find((c) => c.id === id)
    const el = document.createElement('span')
    el.className = 'cm-slash-icon'
    el.textContent = cmd?.icon ?? ''
    return el
  },
  position: 20,
}
