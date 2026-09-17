import { autocompletion, type Completion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete'
import type { EditorContextRef } from './link-context'
import { slashIcons, slashSource } from './slash-commands'

export function wikilinkSource(ctx: EditorContextRef) {
  return (context: CompletionContext): CompletionResult | null => {
    const before = context.matchBefore(/!?\[\[[^[\]|#\n]*$/)
    if (!before) return null
    const bracket = before.text.indexOf('[[')
    const from = before.from + bracket + 2
    const after = context.state.doc.sliceString(context.pos, context.pos + 2)

    const options: Completion[] = ctx.current.targets().map((t) => ({
      label: t.label,
      detail: t.detail,
      type: t.kind === 'ticket' ? 'class' : t.kind === 'attachment' ? 'constant' : 'text',
      apply: (view, _completion, applyFrom, applyTo) => {
        const insert = after === ']]' ? t.label : `${t.label}]]`
        view.dispatch({
          changes: { from: applyFrom, to: applyTo, insert },
          selection: { anchor: applyFrom + t.label.length + 2 },
        })
      },
    }))
    return { from, options, validFor: /^[^[\]|#\n]*$/ }
  }
}

/** `[[` link suggestions and the `/` command menu share one autocompletion instance. */
export function editorCompletion(ctx: EditorContextRef) {
  return autocompletion({
    override: [wikilinkSource(ctx), slashSource(ctx)],
    icons: false,
    addToOptions: [slashIcons],
    maxRenderedOptions: 50,
    activateOnTyping: true,
  })
}
