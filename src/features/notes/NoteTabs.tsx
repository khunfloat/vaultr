import { FileText, X } from 'lucide-react'
import { useNavigate } from 'react-router'
import { routes } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { stem } from '@/vault/paths'
import { useVault } from '@/vault/vault-store'
import { useNotesUi } from './notes-store'

export function NoteTabs({ active }: { active: string | null }) {
  const tabs = useNotesUi((s) => s.tabs)
  const closeTab = useNotesUi((s) => s.closeTab)
  const files = useVault((s) => s.files)
  const navigate = useNavigate()
  if (!tabs.length) return null

  const close = (path: string) => {
    const next = closeTab(path)
    if (path === active) navigate(next ? routes.note(next) : routes.notes())
  }

  return (
    <div className="flex h-10 shrink-0 items-end gap-0.5 overflow-x-auto border-b bg-sidebar px-2" role="tablist">
      {tabs.map((path) => {
        const on = path === active
        const missing = !files.has(path)
        return (
          <div
            key={path}
            role="tab"
            aria-selected={on}
            className={cn(
              'group -mb-px flex h-8 max-w-55 shrink-0 cursor-pointer items-center gap-2 rounded-t-md border border-transparent pr-1.5 pl-3 text-muted-foreground hover:text-foreground',
              on && 'border-border border-b-background bg-background text-foreground',
            )}
            onClick={() => navigate(routes.note(path))}
            onAuxClick={(e) => e.button === 1 && close(path)}
            title={path}
          >
            <FileText className="size-3.5 shrink-0" />
            <span className={cn('truncate', missing && 'line-through opacity-60')}>{files.get(path)?.title ?? stem(path)}</span>
            <button
              className="grid size-5 place-items-center rounded opacity-50 hover:bg-accent hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation()
                close(path)
              }}
              aria-label="Close tab"
            >
              <X className="size-3" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
