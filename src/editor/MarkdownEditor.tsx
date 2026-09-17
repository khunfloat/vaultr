import { closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownKeymap, markdownLanguage } from '@codemirror/lang-markdown'
import { searchKeymap } from '@codemirror/search'
import { Compartment, EditorState, Prec } from '@codemirror/state'
import { EditorView, keymap, placeholder as placeholderExt } from '@codemirror/view'
import { Check, Copy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { type EditorContext, type EditorContextRef, refresh } from './link-context'
import { linkShortcut } from './link-shortcut'
import { livePreview } from './live-preview'
import { sourceMode } from './source-mode'
import { editorTheme, markdownHighlight } from './theme'
import { editorCompletion } from './wikilink-complete'

export type EditorMode = 'live' | 'source'

export interface MarkdownEditorProps {
  /** Initial document. The editor is uncontrolled: remount (change `key`) to load different content. */
  initialValue: string
  onChange(value: string): void
  context: EditorContext
  mode?: EditorMode
  readOnly?: boolean
  placeholder?: string
  autoFocus?: boolean
  className?: string
  onBlur?(): void
  /** Receives the EditorView once mounted (for scrolling to headings etc.). */
  onReady?(view: EditorView | null): void
  /** Shown in the source-mode header, e.g. `Login flow.md`. */
  fileName?: string
}

/** Extensions that differ per mode. Live wraps like prose; source behaves like a code editor. */
function modeExtensions(mode: EditorMode, ctx: EditorContextRef) {
  return mode === 'live' ? [livePreview(ctx), markdownHighlight, EditorView.lineWrapping] : sourceMode()
}

export function MarkdownEditor({ initialValue, onChange, context, mode = 'live', readOnly = false, placeholder, autoFocus, className, onBlur, onReady, fileName }: MarkdownEditorProps) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const ctx = useRef<EditorContextRef>({ current: context }).current
  const handlers = useRef({ onChange, onBlur, onReady })
  handlers.current = { onChange, onBlur, onReady }
  const modeCompartment = useRef(new Compartment()).current
  const readOnlyCompartment = useRef(new Compartment()).current

  useEffect(() => {
    const state = EditorState.create({
      doc: initialValue,
      extensions: [
        history(),
        closeBrackets(),
        markdown({ base: markdownLanguage, addKeymap: true }),
        editorTheme,
        EditorView.contentAttributes.of({ spellcheck: 'false', autocapitalize: 'off' }),
        editorCompletion(ctx),
        linkShortcut(),
        // lang-markdown registers its Enter handler at Prec.high; ours must run first.
        Prec.highest(keymap.of([{ key: 'Enter', run: exitEmptyQuote }])),
        keymap.of([...closeBracketsKeymap, ...completionKeymap, ...markdownKeymap, ...searchKeymap, ...historyKeymap, indentWithTab, ...defaultKeymap]),
        placeholder ? placeholderExt(placeholder) : [],
        modeCompartment.of(modeExtensions(mode, ctx)),
        readOnlyCompartment.of([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) handlers.current.onChange(u.state.doc.toString())
          if (u.focusChanged && !u.view.hasFocus) handlers.current.onBlur?.()
        }),
        EditorView.domEventHandlers({
          mousedown(event, v) {
            const el = event.target as HTMLElement
            const link = el.closest<HTMLElement>('.cm-lp-wikilink, .cm-lp-embed')
            const href = el.closest<HTMLElement>('.cm-lp-link')?.dataset.href
            const modifier = event.ctrlKey || event.metaKey
            const onRaw = !!el.closest('.cm-line') && v.hasFocus && !!link && isOnActiveLine(v, el)
            if (link?.dataset.target && (!onRaw || modifier)) {
              event.preventDefault()
              ctx.current.openLink(link.dataset.target, { newTab: modifier })
              return true
            }
            if (href && modifier) {
              event.preventDefault()
              window.open(href, '_blank', 'noopener')
              return true
            }
            return false
          },
          paste(event, v) {
            const files = [...(event.clipboardData?.files ?? [])]
            if (!files.length || readOnly) return false
            event.preventDefault()
            void insertFiles(v, files, v.state.selection.main.from)
            return true
          },
          drop(event, v) {
            const files = [...(event.dataTransfer?.files ?? [])]
            if (!files.length || readOnly) return false
            event.preventDefault()
            const pos = v.posAtCoords({ x: event.clientX, y: event.clientY }) ?? v.state.selection.main.from
            void insertFiles(v, files, pos)
            return true
          },
        }),
      ],
    })
    const v = new EditorView({ state, parent: host.current! })
    view.current = v
    handlers.current.onReady?.(v)
    if (autoFocus) v.focus()

    async function insertFiles(target: EditorView, files: File[], pos: number) {
      const links: string[] = []
      for (const file of files) {
        try {
          links.push(`![[${await ctx.current.saveFile(file)}]]`)
        } catch (e) {
          console.error('attachment failed', e)
        }
      }
      if (!links.length) return
      const insert = links.join('\n')
      target.dispatch({ changes: { from: pos, insert }, selection: { anchor: pos + insert.length } })
      target.focus()
    }

    return () => {
      handlers.current.onReady?.(null)
      v.destroy()
      view.current = null
    }
    // The editor is uncontrolled; props below are applied through compartments/refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    ctx.current = context
    if (view.current) refresh(view.current)
  }, [context, ctx])

  useEffect(() => {
    view.current?.dispatch({ effects: modeCompartment.reconfigure(modeExtensions(mode, ctx)) })
  }, [mode, ctx, modeCompartment])

  useEffect(() => {
    view.current?.dispatch({
      effects: readOnlyCompartment.reconfigure([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]),
    })
  }, [readOnly, readOnlyCompartment])

  const source = mode === 'source'
  // Keep the host element at a stable position in the tree: CodeMirror owns its DOM, and React
  // must never move or recreate it when switching modes.
  return (
    <div className={cn(source && 'overflow-hidden rounded-lg border border-[#2b2b2b] bg-[#1e1e1e]')}>
      {source && (
        <div className="flex h-9 items-center gap-2 border-b border-[#2b2b2b] bg-[#252526] pr-2 pl-3 text-xs text-[#cccccc]">
          <span className="font-mono text-[#519aba]">M↓</span>
          <span className="truncate">{fileName ?? 'markdown'}</span>
          <span className="text-[#858585]">Markdown</span>
          <CopyButton getText={() => view.current?.state.doc.toString() ?? ''} className="ml-auto" />
        </div>
      )}
      <div ref={host} className={cn('md-editor', source && 'is-source', className)} />
    </div>
  )
}

export function CopyButton({ getText, className }: { getText(): string; className?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await copyText(getText())
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      type="button"
      className={cn('flex h-6 items-center gap-1.5 rounded px-2 text-[#cccccc] hover:bg-white/10', copied && 'text-status-green', className)}
      onClick={() => void copy()}
      aria-label="Copy markdown"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // Some locked-down browsers block the async clipboard; fall back to a hidden textarea.
    const area = document.createElement('textarea')
    area.value = text
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    document.execCommand('copy')
    area.remove()
  }
}

/**
 * Enter on a quote line with no content leaves the quote instead of adding another `>` line.
 * Nested quotes (`> > `) step out one level at a time.
 */
function exitEmptyQuote(view: EditorView): boolean {
  const { state } = view
  const range = state.selection.main
  if (!range.empty) return false
  const line = state.doc.lineAt(range.head)
  if (!/^\s*(?:>\s*)+$/.test(line.text) || range.head !== line.to) return false
  const outer = line.text.replace(/>\s*$/, '').trimEnd()
  // Leaving the outermost quote needs a blank line, otherwise markdown treats the next line as a lazy continuation.
  const next = outer ? `${outer} ` : '\n'
  view.dispatch({ changes: { from: line.from, to: line.to, insert: next }, selection: { anchor: line.from + next.length } })
  return true
}

function isOnActiveLine(view: EditorView, el: HTMLElement): boolean {
  const pos = view.posAtDOM(el)
  const line = view.state.doc.lineAt(pos).number
  return view.state.selection.ranges.some((r) => view.state.doc.lineAt(r.from).number <= line && view.state.doc.lineAt(r.to).number >= line)
}
