import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'

export const editorTheme = EditorView.theme(
  {
    '&': { color: 'var(--foreground)', backgroundColor: 'transparent', fontSize: '14px' },
    '.cm-content': { fontFamily: 'var(--app-font-sans)', lineHeight: '1.7', padding: '0 0 40vh', caretColor: 'var(--foreground)' },
    '.cm-scroller': { fontFamily: 'var(--app-font-sans)', overflow: 'visible' },
    '&.cm-focused': { outline: 'none' },
    '.cm-line': { padding: '0' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--foreground)', borderLeftWidth: '1.5px' },
    '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection': {
      backgroundColor: 'rgb(96 165 250 / 28%) !important',
    },
    '.cm-placeholder': { color: 'var(--subtle-foreground)' },
    '.cm-tooltip': { backgroundColor: 'var(--popover)', border: '1px solid var(--border-strong)', borderRadius: '8px', overflow: 'hidden' },
    '.cm-tooltip.cm-tooltip-autocomplete > ul': { fontFamily: 'var(--app-font-sans)', fontSize: '13px', maxHeight: '260px', padding: '4px' },
    '.cm-tooltip-autocomplete > ul > li': { padding: '5px 8px !important', borderRadius: '5px', color: 'var(--muted-foreground)' },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: 'var(--muted)', color: 'var(--foreground)' },
    '.cm-completionSection': { padding: '6px 8px 2px', border: 'none', fontSize: '11px', fontWeight: '500', color: 'var(--subtle-foreground)', opacity: '1' },
    '.cm-slash-icon': {
      display: 'inline-grid',
      placeItems: 'center',
      width: '28px',
      height: '28px',
      marginRight: '10px',
      border: '1px solid var(--border-strong)',
      borderRadius: '6px',
      background: 'var(--background)',
      color: 'var(--foreground)',
      fontSize: '12px',
      fontWeight: '600',
      verticalAlign: 'middle',
    },
    '.cm-tooltip-autocomplete > ul > li:has(.cm-slash-icon)': { display: 'flex', alignItems: 'center', minWidth: '260px' },
    '.cm-tooltip-autocomplete > ul > li:has(.cm-slash-icon) .cm-completionDetail': { marginLeft: 'auto', paddingLeft: '16px', fontFamily: 'var(--app-font-mono)' },
    '.cm-completionDetail': { marginLeft: '12px', fontStyle: 'normal', fontSize: '11px', color: 'var(--subtle-foreground)' },
    '.cm-panels': { backgroundColor: 'var(--popover)', color: 'var(--foreground)', borderColor: 'var(--border)' },
    '.cm-searchMatch': { backgroundColor: 'rgb(251 191 36 / 25%)' },
  },
  { dark: true },
)

/** Syntax colours used in both modes; live preview adds structure on top. */
export const markdownHighlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: t.heading, fontWeight: '650', color: 'var(--foreground)' },
    { tag: t.strong, fontWeight: '650' },
    { tag: t.emphasis, fontStyle: 'italic' },
    { tag: t.strikethrough, textDecoration: 'line-through' },
    { tag: [t.processingInstruction, t.meta], color: 'var(--subtle-foreground)' },
    { tag: t.monospace, fontFamily: 'var(--app-font-mono)', fontSize: '12.5px' },
    { tag: [t.link, t.url], color: 'var(--status-blue)' },
    { tag: t.quote, color: 'var(--muted-foreground)' },
    { tag: t.contentSeparator, color: 'var(--subtle-foreground)' },
  ]),
)
