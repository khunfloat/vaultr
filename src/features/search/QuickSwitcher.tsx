import { FileText, Kanban } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { useUi } from '@/app/ui-store'
import { Badge } from '@/components/ui/badge'
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { routes } from '@/lib/routes'
import { dirname, stem } from '@/vault/paths'
import { useVault } from '@/vault/vault-store'
import { statusLabel } from '@/features/board/ticket-meta'

export function QuickSwitcher() {
  const open = useUi((s) => s.switcherOpen)
  const setOpen = useUi((s) => s.setSwitcherOpen)
  const files = useVault((s) => s.files)
  const navigate = useNavigate()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === 'o' || e.key === 'k')) {
        e.preventDefault()
        setOpen(!useUi.getState().switcherOpen)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setOpen])

  const { notes, tickets } = useMemo(() => {
    const all = [...files.values()]
    return {
      notes: all.filter((f) => f.kind === 'note'),
      tickets: all.filter((f) => f.kind === 'ticket'),
    }
  }, [files])

  const go = (to: string) => {
    setOpen(false)
    navigate(to)
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Quick switcher" description="Jump to a note or ticket" className="sm:max-w-xl">
      <Command>
      <CommandInput placeholder="Find a note or ticket…" />
      <CommandList className="max-h-[360px]">
        <CommandEmpty>No matches</CommandEmpty>
        {notes.length > 0 && (
          <CommandGroup heading="Notes">
            {notes.map((f) => (
              <CommandItem key={f.path} value={`note:${f.path}`} keywords={[f.title, ...f.tags]} onSelect={() => go(routes.note(f.path))}>
                <FileText />
                <span className="min-w-0 flex-1 truncate">{f.title || stem(f.path)}</span>
                <span className="max-w-[45%] truncate pl-4 text-xs text-subtle-foreground">{dirname(f.path).replace(/^notes\/?/, '')}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {tickets.length > 0 && (
          <CommandGroup heading="Tickets">
            {tickets.map((f) => {
              const key = String(f.frontmatter.key ?? stem(f.path))
              return (
                <CommandItem key={f.path} value={`ticket:${f.path}`} keywords={[key, f.title]} onSelect={() => go(routes.ticket(key))}>
                  <Kanban />
                  <span className="font-mono text-xs text-subtle-foreground">{key}</span>
                  <span className="min-w-0 flex-1 truncate">{f.title}</span>
                  <Badge variant="outline">
                    {statusLabel(f.frontmatter.status)}
                  </Badge>
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}
      </CommandList>
      </Command>
    </CommandDialog>
  )
}
