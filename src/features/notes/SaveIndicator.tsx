import { Check, CircleAlert, Loader2 } from 'lucide-react'
import type { SaveState } from './use-document'

export function SaveIndicator({ state, error, onRetry }: { state: SaveState; error?: string | null; onRetry?(): void }) {
  if (state === 'idle') return null
  if (state === 'error')
    return (
      <span className="flex items-center gap-1.5 text-xs text-status-red" title={error ?? undefined}>
        <CircleAlert className="size-3.5" /> Not saved
        {onRetry && error && (
          <button className="rounded border border-status-red/40 px-1.5 leading-5 hover:bg-status-red/10" onClick={onRetry}>
            Retry
          </button>
        )}
      </span>
    )
  if (state === 'saved')
    return (
      <span className="flex items-center gap-1 text-xs text-subtle-foreground">
        <Check className="size-3.5" /> Saved
      </span>
    )
  return (
    <span className="flex items-center gap-1 text-xs text-subtle-foreground">
      <Loader2 className="size-3.5 animate-spin" /> Saving…
    </span>
  )
}
