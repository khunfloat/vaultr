import { StateEffect } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

export interface LinkTarget {
  /** Text inserted into `[[…]]`. */
  label: string
  detail: string
  kind: 'note' | 'ticket' | 'attachment'
}

/** Everything the editor needs from the app. Held in a mutable ref so React can update it without rebuilding the editor. */
export interface EditorContext {
  path: string | null
  resolve(target: string): string | null
  targets(): LinkTarget[]
  openLink(target: string, opts: { newTab: boolean }): void
  loadImage(path: string): Promise<string | null>
  saveFile(file: File): Promise<string>
}

export interface EditorContextRef {
  current: EditorContext
}

/** Dispatch to force live-preview decorations to recompute (e.g. after links resolve differently). */
export const refreshDecorations = StateEffect.define<null>()

export function refresh(view: EditorView) {
  view.dispatch({ effects: refreshDecorations.of(null) })
}
