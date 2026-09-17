import { Prec } from '@codemirror/state'
import { Decoration, type DecorationSet, EditorView, keymap, ViewPlugin, type ViewUpdate, WidgetType } from '@codemirror/view'
import { linkLabel, normalizeUrl } from '@/lib/url'

const SHORTCUT = /(^|\s)\/link[ \t]*(\S+)$/i
const WAITING = /(^|\s)\/link[ \t]*$/i
const NEEDS_SPACE = /(^|\s)\/link$/i

/** Text to insert when pasting right after `/link`: adds the separating space so it reads `/link https://…`. */
export function pasteAfterLink(lineBeforeCursor: string, pasted: string): string {
  return NEEDS_SPACE.test(lineBeforeCursor) && !/^\s/.test(pasted) ? ` ${pasted.trim()}` : pasted
}

/**
 * `/link https://…` right before the cursor → `[label](url)`. Returns the range to replace, or null
 * when the text isn't the shortcut or the URL is invalid (so Space just types a space).
 */
export function linkShortcutEdit(lineBeforeCursor: string): { start: number; insert: string } | null {
  const m = SHORTCUT.exec(lineBeforeCursor)
  if (!m) return null
  const url = normalizeUrl(m[2])
  if (!url) return null
  const start = m.index + m[1].length
  // encodeURIComponent leaves ( and ) alone, but they would end the markdown link early.
  const safeUrl = url.replace(/[()\s]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`)
  return { start, insert: `[${linkLabel(url).replace(/[[\]]/g, '')}](${safeUrl})` }
}

function convert(view: EditorView, trailing: string): boolean {
  const { state } = view
  const range = state.selection.main
  if (!range.empty) return false
  const line = state.doc.lineAt(range.head)
  const edit = linkShortcutEdit(line.text.slice(0, range.head - line.from))
  if (!edit) return false
  const from = line.from + edit.start
  const insert = edit.insert + trailing
  view.dispatch({ changes: { from, to: range.head, insert }, selection: { anchor: from + insert.length }, userEvent: 'input.link' })
  return true
}

class HintWidget extends WidgetType {
  eq() {
    return true
  }
  toDOM() {
    const el = document.createElement('span')
    el.className = 'cm-link-hint'
    el.textContent = 'Paste a link, then press Space'
    return el
  }
}

const hint = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet = Decoration.none
    constructor(view: EditorView) {
      this.decorations = this.build(view)
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.selectionSet || u.focusChanged) this.decorations = this.build(u.view)
    }
    build(view: EditorView): DecorationSet {
      const range = view.state.selection.main
      if (!view.hasFocus || !range.empty) return Decoration.none
      const line = view.state.doc.lineAt(range.head)
      const before = line.text.slice(0, range.head - line.from)
      const after = line.text.slice(range.head - line.from)
      if (!WAITING.test(before) || after.trim()) return Decoration.none
      return Decoration.set([Decoration.widget({ widget: new HintWidget(), side: 1 }).range(range.head)])
    }
  },
  { decorations: (v) => v.decorations },
)

/** Type `/link`, paste a URL, press Space (or Enter) → web link chip. */
export function linkShortcut() {
  return [
    EditorView.domEventHandlers({
      paste(event, view) {
        const text = event.clipboardData?.getData('text/plain')
        const range = view.state.selection.main
        if (!text || event.clipboardData?.files.length || !range.empty) return false
        const line = view.state.doc.lineAt(range.head)
        const insert = pasteAfterLink(line.text.slice(0, range.head - line.from), text)
        if (insert === text) return false
        event.preventDefault()
        view.dispatch({ changes: { from: range.head, insert }, selection: { anchor: range.head + insert.length }, userEvent: 'input.paste' })
        return true
      },
    }),
    Prec.highest(
      keymap.of([
        { key: 'Space', run: (view) => convert(view, ' ') },
        // Convert, then let Enter continue normally (new line, list continuation…).
        { key: 'Enter', run: (view) => (convert(view, ''), false) },
      ]),
    ),
    hint,
  ]
}
