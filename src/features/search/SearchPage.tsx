import { FileText, Kanban, Search } from 'lucide-react'
import { useDeferredValue, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { PageHeader } from '@/app/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { statusLabel } from '@/features/board/ticket-meta'
import { buildSearchIndex } from '@/index/search'
import { routes } from '@/lib/routes'
import { dirname } from '@/vault/paths'
import { useVault } from '@/vault/vault-store'

export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const deferred = useDeferredValue(query)
  const files = useVault((s) => s.files)
  const navigate = useNavigate()
  const index = useMemo(() => buildSearchIndex(files.values()), [files])
  const hits = useMemo(() => index.search(deferred), [index, deferred])

  return (
    <>
      <PageHeader>
        <Search className="size-4" /> <b>Search</b>
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-190 px-6 py-6">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle-foreground" />
            <Input
              autoFocus
              className="h-10 pl-9 text-sm"
              placeholder="Search notes and tickets…  (use #tag to filter)"
              value={query}
              onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })}
            />
          </div>
          <p className="mt-3 mb-2 text-xs text-subtle-foreground">{deferred ? `${hits.length} result${hits.length === 1 ? '' : 's'}` : 'Type to search titles, content, tags and ticket keys.'}</p>
          <div className="flex flex-col gap-1">
            {hits.map((hit) => {
              const f = files.get(hit.path)!
              const isTicket = f.kind === 'ticket'
              return (
                <button
                  key={hit.path}
                  className="rounded-lg border border-transparent px-3 py-2.5 text-left hover:border-border hover:bg-accent"
                  onClick={() => navigate(isTicket ? routes.ticket(String(f.frontmatter.key)) : routes.note(hit.path))}
                >
                  <div className="flex items-center gap-2">
                    {isTicket ? <Kanban className="size-4 text-muted-foreground" /> : <FileText className="size-4 text-muted-foreground" />}
                    {isTicket && <span className="font-mono text-xs text-subtle-foreground">{String(f.frontmatter.key)}</span>}
                    <span className="font-medium">{f.title}</span>
                    {isTicket ? (
                      <Badge variant="outline" className="ml-auto">
                        {statusLabel(f.frontmatter.status)}
                      </Badge>
                    ) : (
                      <span className="ml-auto truncate text-xs text-subtle-foreground">{dirname(hit.path).replace(/^notes\/?/, '')}</span>
                    )}
                  </div>
                  {hit.snippet && (
                    <p className="mt-1 line-clamp-2 text-[12.5px] text-muted-foreground">
                      {hit.snippet.before}
                      <mark className="rounded-sm bg-status-amber/25 px-0.5 text-foreground">{hit.snippet.match}</mark>
                      {hit.snippet.after}
                    </p>
                  )}
                  {f.tags.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {f.tags.slice(0, 6).map((t) => (
                        <span key={t} className="rounded-full bg-status-blue/12 px-2 text-[11px] leading-5 text-status-blue">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
