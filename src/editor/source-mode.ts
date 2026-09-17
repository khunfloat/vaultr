import { bracketMatching, foldGutter, HighlightStyle, indentOnInput, syntaxHighlighting } from '@codemirror/language'
import { Prec } from '@codemirror/state'
import { EditorView, highlightActiveLine, highlightActiveLineGutter, lineNumbers } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'

/** Markdown token colours from VS Code's "Dark+" theme. */
const darkPlus = HighlightStyle.define([
  { tag: t.heading, color: '#569cd6', fontWeight: 'bold' },
  { tag: t.strong, color: '#569cd6', fontWeight: 'bold' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.monospace, color: '#ce9178' },
  { tag: t.quote, color: '#6a9955' },
  { tag: [t.link, t.url], color: '#3794ff' },
  { tag: t.list, color: '#6796e6' },
  { tag: [t.processingInstruction, t.meta, t.contentSeparator], color: '#808080' },
  { tag: t.labelName, color: '#4ec9b0' },
  { tag: t.escape, color: '#d7ba7d' },
])

const sourceTheme = EditorView.theme({
  '&': { backgroundColor: '#1e1e1e', color: '#d4d4d4' },
  '.cm-scroller': { fontFamily: 'var(--app-font-mono)', lineHeight: '20px' },
  '.cm-content': { fontFamily: 'var(--app-font-mono)', fontSize: '13px', lineHeight: '20px', padding: '8px 0 24px' },
  '.cm-line': { padding: '0 16px 0 8px' },
  '.cm-gutters': { backgroundColor: '#1e1e1e', color: '#6e7681', border: 'none', fontFamily: 'var(--app-font-mono)', fontSize: '12px' },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 8px 0 16px', minWidth: '44px' },
  '.cm-activeLine': { backgroundColor: 'rgb(255 255 255 / 4%)', boxShadow: 'inset 0 1px 0 #282828, inset 0 -1px 0 #282828' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: '#c6c6c6' },
  '.cm-foldGutter .cm-gutterElement': { padding: '0 4px', color: '#c5c5c5', opacity: '0', transition: 'opacity 120ms' },
  '.cm-gutters:hover .cm-foldGutter .cm-gutterElement': { opacity: '1' },
  '.cm-foldPlaceholder': { backgroundColor: '#264f78', border: 'none', color: '#d4d4d4', padding: '0 6px', borderRadius: '3px' },
  '&.cm-focused .cm-matchingBracket': { backgroundColor: 'rgb(0 100 0 / 40%)', outline: '1px solid #888' },
  '.cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': { backgroundColor: '#264f78 !important' },
  '.cm-cursor': { borderLeftColor: '#aeafad' },
})

/** VS Code–style source view: line numbers, fold arrows, active line, bracket matching, Dark+ colours. Long lines wrap. */
export function sourceMode() {
  return [
    EditorView.lineWrapping,
    lineNumbers(),
    foldGutter({ openText: '⌄', closedText: '›' }),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    bracketMatching(),
    indentOnInput(),
    syntaxHighlighting(darkPlus),
    // The base editor theme is registered first (higher priority); lift this one above it.
    Prec.high(sourceTheme),
  ]
}
