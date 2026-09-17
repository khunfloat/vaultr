import { syntaxTree } from '@codemirror/language'
import { type EditorState, type Range, StateEffect, StateField } from '@codemirror/state'
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import type { SyntaxNodeRef } from '@lezer/common'
import { isImagePath } from '@/services/attachments'
import { type EditorContextRef, refreshDecorations } from './link-context'
import { isWebUrl } from '@/lib/url'
import { BulletWidget, CalloutTitleWidget, CheckboxWidget, CodeLangWidget, EmbedWidget, HrWidget, ImageWidget, LinkChipWidget, TableWidget } from './widgets'

const WIKILINK = /(!?)\[\[([^[\]|#^\n]*)(?:([#^])([^[\]|\n]*))?(?:\|([^[\]\n]*))?\]\]/g
const TAG = /(^|[\s(,])(#(?=[\p{L}\p{N}_/-]*[\p{L}_/-])[\p{L}\p{M}\p{N}_/-]+)/gu
const HIGHLIGHT = /==([^=\n]+)==/g

const hide = Decoration.replace({})

/** Line numbers (1-based) touched by any selection range, only while the editor has focus. */
function activeLines(state: EditorState, focused: boolean): Set<number> {
  const lines = new Set<number>()
  if (!focused) return lines
  for (const r of state.selection.ranges) {
    const a = state.doc.lineAt(r.from).number
    const b = state.doc.lineAt(r.to).number
    for (let n = a; n <= b; n++) lines.add(n)
  }
  return lines
}

function isCodeContext(state: EditorState, pos: number): boolean {
  for (let node: SyntaxNodeRef | null = syntaxTree(state).resolveInner(pos, 1); node; node = node.node.parent) {
    if (/^(InlineCode|FencedCode|CodeBlock|CodeText|HTMLBlock|Comment)/.test(node.name)) return true
  }
  return false
}

function buildInline(view: EditorView, ctx: EditorContextRef): DecorationSet {
  const { state } = view
  const active = activeLines(state, view.hasFocus)
  const isActive = (pos: number) => active.has(state.doc.lineAt(pos).number)
  const decos: Range<Decoration>[] = []
  // CodeMirror rejects empty mark/replace ranges (e.g. `[[]]` while typing), so filter them in one place.
  const push = (d: Range<Decoration>) => {
    if (d.value.point || d.to > d.from) decos.push(d)
  }
  const mark = (spec: Parameters<typeof Decoration.mark>[0], from: number, to: number) => {
    if (to > from) decos.push(Decoration.mark(spec).range(from, to))
  }
  /** Ranges already replaced by lezer-based decorations; regex matches must not overlap them. */
  const taken: [number, number][] = []
  const overlaps = (from: number, to: number) => taken.some(([a, b]) => from < b && to > a)

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter: (node) => {
        const name = node.name
        const lineActive = isActive(node.from)

        const heading = /^(ATX|Setext)Heading(\d)$/.exec(name)
        if (heading) {
          push(Decoration.line({ class: `cm-lp-h cm-lp-h${heading[2]}` }).range(state.doc.lineAt(node.from).from))
          return
        }

        switch (name) {
          case 'HeaderMark': {
            if (lineActive || node.node.parent?.name.startsWith('Setext')) return
            const next = state.doc.sliceString(node.to, node.to + 1)
            push(hide.range(node.from, next === ' ' ? node.to + 1 : node.to))
            return
          }
          case 'Emphasis':
            mark({ class: 'cm-lp-em' }, node.from, node.to)
            return
          case 'StrongEmphasis':
            mark({ class: 'cm-lp-strong' }, node.from, node.to)
            return
          case 'Strikethrough':
            mark({ class: 'cm-lp-strike' }, node.from, node.to)
            return
          case 'EmphasisMark':
          case 'StrikethroughMark':
            if (!lineActive) push(hide.range(node.from, node.to))
            return
          case 'InlineCode':
            mark({ class: 'cm-lp-code' }, node.from, node.to)
            taken.push([node.from, node.to])
            return
          case 'CodeMark':
            if (node.node.parent?.name === 'InlineCode' && !lineActive) push(hide.range(node.from, node.to))
            return
          case 'FencedCode':
          case 'CodeBlock': {
            const first = state.doc.lineAt(node.from).number
            const last = state.doc.lineAt(node.to).number
            let blockActive = false
            for (let n = first; n <= last; n++) blockActive ||= active.has(n)
            for (let n = first; n <= last; n++) {
              const line = state.doc.line(n)
              const fence = name === 'FencedCode' && (n === first || n === last)
              const cls = `cm-lp-codeblock${n === first ? ' is-first' : ''}${n === last ? ' is-last' : ''}${fence ? ' is-fence' : ''}`
              push(Decoration.line({ class: cls }).range(line.from))
            }
            // Outside the block, the ``` fences collapse to a language label (Obsidian-style).
            if (name === 'FencedCode' && !blockActive) {
              const open = state.doc.line(first)
              const info = node.node.getChild('CodeInfo')
              const lang = info ? state.doc.sliceString(info.from, info.to) : ''
              push(Decoration.replace({ widget: new CodeLangWidget(lang) }).range(open.from, open.to))
              const close = state.doc.line(last)
              if (last > first && /^\s*(`{3,}|~{3,})\s*$/.test(close.text)) push(hide.range(close.from, close.to))
            }
            taken.push([node.from, node.to])
            return false
          }
          case 'Blockquote': {
            const first = state.doc.lineAt(node.from).number
            const last = state.doc.lineAt(node.to).number
            // Obsidian callout: `> [!note] Optional title`
            const callout = /^\s*>\s*\[!(\w+)\][+-]?/.exec(state.doc.line(first).text)
            const type = callout?.[1].toLowerCase()
            for (let n = first; n <= last; n++) {
              const cls = callout ? `cm-lp-callout is-${type}${n === first ? ' is-first' : ''}${n === last ? ' is-last' : ''}` : 'cm-lp-quote'
              push(Decoration.line({ class: cls }).range(state.doc.line(n).from))
            }
            if (callout) {
              const line = state.doc.line(first)
              const markerFrom = line.from + callout[0].indexOf('[')
              const markerTo = line.from + callout[0].length
              if (!active.has(first)) push(Decoration.replace({ widget: new CalloutTitleWidget(type!, line.text.slice(callout[0].length).trim()) }).range(markerFrom, line.to))
              else mark({ class: 'cm-lp-syntax' }, markerFrom, markerTo)
            }
            return
          }
          case 'QuoteMark':
            if (!lineActive) {
              const next = state.doc.sliceString(node.to, node.to + 1)
              push(hide.range(node.from, next === ' ' ? node.to + 1 : node.to))
            }
            return
          case 'HorizontalRule':
            if (!lineActive) push(Decoration.replace({ widget: new HrWidget() }).range(node.from, node.to))
            return
          case 'ListMark': {
            const item = node.node.parent
            const isTask = item?.getChild('Task') !== null && item?.getChild('Task') !== undefined
            const text = state.doc.sliceString(node.from, node.to)
            if (lineActive || !/^[-*+]$/.test(text)) return
            if (isTask) push(hide.range(node.from, node.to + 1))
            else push(Decoration.replace({ widget: new BulletWidget() }).range(node.from, node.to))
            return
          }
          case 'TaskMarker': {
            const cursorInside = state.selection.ranges.some((r) => r.from <= node.to && r.to >= node.from) && view.hasFocus
            const checked = /x/i.test(state.doc.sliceString(node.from, node.to))
            if (!cursorInside) push(Decoration.replace({ widget: new CheckboxWidget(checked, node.from) }).range(node.from, node.to))
            const task = node.node.parent
            if (checked && task) mark({ class: 'cm-lp-task-done' }, node.to, task.to)
            return
          }
          case 'Link': {
            const marks = node.node.getChildren('LinkMark')
            const url = node.node.getChild('URL')
            // `[x]` without a URL is a shortcut reference; inside `[[x]]` it's our wikilink, so leave it to the regex pass.
            if (!url || marks.length < 2) return
            taken.push([node.from, node.to])
            const textFrom = marks[0].to
            const textTo = marks[1].from
            const href = url ? state.doc.sliceString(url.from, url.to) : ''
            if (isWebUrl(href) && !lineActive) {
              push(Decoration.replace({ widget: new LinkChipWidget(href, state.doc.sliceString(textFrom, textTo)) }).range(node.from, node.to))
              return false
            }
            if (textTo > textFrom) {
              mark({ class: 'cm-lp-link', attributes: { 'data-href': href } }, textFrom, textTo)
            }
            if (!lineActive) {
              push(hide.range(node.from, textFrom))
              push(hide.range(textTo, node.to))
            }
            return false
          }
          case 'Autolink':
          case 'URL': {
            // Bare `https://…` (GFM) and `<https://…>` become chips; URLs inside [text](url) are handled by Link.
            if (name === 'URL' && node.node.parent?.name !== 'Paragraph') return
            const urlNode = name === 'Autolink' ? node.node.getChild('URL') : node.node
            const href = urlNode ? state.doc.sliceString(urlNode.from, urlNode.to) : ''
            if (!isWebUrl(href)) return
            taken.push([node.from, node.to])
            if (!lineActive) push(Decoration.replace({ widget: new LinkChipWidget(href, '') }).range(node.from, node.to))
            return false
          }
          case 'Image': {
            const url = node.node.getChild('URL')
            if (!url) return
            taken.push([node.from, node.to])
            if (lineActive) return false
            const marks = node.node.getChildren('LinkMark')
            const src = url ? state.doc.sliceString(url.from, url.to) : ''
            const alt = marks.length >= 2 ? state.doc.sliceString(marks[0].to, marks[1].from) : ''
            const isRemote = /^(https?:|data:|blob:)/.test(src)
            const vaultPath = isRemote ? null : ctx.current.resolve(decodeURIComponent(src))
            push(Decoration.replace({ widget: new ImageWidget(isRemote ? src : '', vaultPath, alt, ctx) }).range(node.from, node.to))
            return false
          }
        }
      },
    })

    // Obsidian syntax the markdown grammar doesn't know: [[wikilinks]], ![[embeds]], #tags, ==highlights==
    for (let pos = from; pos <= to; ) {
      const line = state.doc.lineAt(pos)
      const lineActive = active.has(line.number)
      const text = line.text

      for (const m of text.matchAll(WIKILINK)) {
        const start = line.from + m.index
        const end = start + m[0].length
        if (overlaps(start, end) || isCodeContext(state, start)) continue
        taken.push([start, end])
        const [, bang, target, sep, sub, alias] = m
        const resolved = target.trim() ? ctx.current.resolve(target.trim()) : ctx.current.path
        const fullTarget = `${target}${sep ?? ''}${sub ?? ''}`

        if (bang && !lineActive) {
          const widget =
            resolved && isImagePath(resolved)
              ? new ImageWidget('', resolved, target, ctx)
              : new EmbedWidget(fullTarget, resolved)
          push(Decoration.replace({ widget }).range(start, end))
          continue
        }

        const cls = `cm-lp-wikilink${resolved ? '' : ' is-unresolved'}`
        const attrs = { 'data-target': fullTarget }
        if (lineActive) {
          mark({ class: 'cm-lp-syntax' }, start, start + bang.length + 2)
          mark({ class: cls, attributes: attrs }, start + bang.length + 2, end - 2)
          mark({ class: 'cm-lp-syntax' }, end - 2, end)
        } else {
          const labelFrom = alias !== undefined ? end - 2 - alias.length : start + bang.length + 2
          const labelTo = alias !== undefined ? end - 2 : start + bang.length + 2 + target.length + (sep ? 1 + (sub?.length ?? 0) : 0)
          push(hide.range(start, labelFrom))
          if (labelTo > labelFrom) mark({ class: cls, attributes: attrs }, labelFrom, labelTo)
          push(hide.range(labelTo, end))
        }
      }

      for (const m of text.matchAll(TAG)) {
        const start = line.from + m.index + m[1].length
        const end = start + m[2].length
        if (overlaps(start, end) || isCodeContext(state, start)) continue
        if (syntaxTree(state).resolveInner(start, 1).name.startsWith('HeaderMark')) continue
        mark({ class: 'cm-lp-tag', attributes: { 'data-tag': m[2].slice(1) } }, start, end)
      }

      for (const m of text.matchAll(HIGHLIGHT)) {
        const start = line.from + m.index
        const end = start + m[0].length
        if (overlaps(start, end) || isCodeContext(state, start)) continue
        mark({ class: 'cm-lp-highlight' }, start, end)
        if (!lineActive) {
          push(hide.range(start, start + 2))
          push(hide.range(end - 2, end))
        }
      }

      pos = line.to + 1
    }
  }

  return Decoration.set(decos, true)
}

/** Tables are replaced by rendered widgets when the selection is outside them. Block widgets must come from a StateField. */
const tableField = StateField.define<DecorationSet>({
  create: (state) => buildTables(state, false),
  update(value, tr) {
    const focusChanged = tr.effects.some((e) => e.is(focusEffect))
    if (!tr.docChanged && !tr.selection && !focusChanged) return value
    return buildTables(tr.state, tr.effects.find((e) => e.is(focusEffect))?.value ?? focusedField(tr.state))
  },
  provide: (f) => EditorView.decorations.from(f),
})

const focusEffect = StateEffect.define<boolean>()
const focusState = StateField.define<boolean>({
  create: () => false,
  update: (v, tr) => tr.effects.find((e) => e.is(focusEffect))?.value ?? v,
})
const focusedField = (state: EditorState) => state.field(focusState, false) ?? false

function buildTables(state: EditorState, focused: boolean): DecorationSet {
  const decos: Range<Decoration>[] = []
  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== 'Table') return
      const selected = focused && state.selection.ranges.some((r) => r.from <= node.to && r.to >= node.from)
      if (selected) return false
      const from = state.doc.lineAt(node.from).from
      const to = state.doc.lineAt(node.to).to
      decos.push(Decoration.replace({ widget: new TableWidget(state.doc.sliceString(from, to)), block: true }).range(from, to))
      return false
    },
  })
  return Decoration.set(decos, true)
}

export function livePreview(ctx: EditorContextRef) {
  const inline = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      constructor(view: EditorView) {
        this.decorations = buildInline(view, ctx)
      }
      update(u: ViewUpdate) {
        if (
          u.docChanged ||
          u.selectionSet ||
          u.viewportChanged ||
          u.focusChanged ||
          syntaxTree(u.startState) !== syntaxTree(u.state) ||
          u.transactions.some((t) => t.effects.some((e) => e.is(refreshDecorations)))
        ) {
          this.decorations = buildInline(u.view, ctx)
        }
      }
    },
    { decorations: (v) => v.decorations },
  )

  const focusSync = EditorView.focusChangeEffect.of((_state, focusing) => focusEffect.of(focusing))

  return [inline, focusState, tableField, focusSync, EditorView.editorAttributes.of({ class: 'cm-live-preview' })]
}
