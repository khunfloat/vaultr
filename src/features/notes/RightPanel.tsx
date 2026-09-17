import { FileText, Hash, Kanban, Link2 } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { plainText } from '@/index/search'
import { useLinkGraph } from '@/index/use-link-graph'
import type { Heading } from '@/markdown/extract'
import { routes } from '@/lib/routes'
import { useVault } from '@/vault/vault-store'
import { useNotesUi } from './notes-store'
import { useOpenLink } from './use-editor-context'

export function RightPanel({ path, headings, onHeading }: { path: string; headings: Heading[]; onHeading(h: Heading): void }) {
  const panel = useNotesUi((s) => s.rightPanel)
  const setPanel = useNotesUi((s) => s.setRightPanel)
  return (
    <aside className="hidden w-70 shrink-0 flex-col border-l lg:flex">
      <div className="p-3 pb-0">
        <Tabs value={panel} onValueChange={(v) => setPanel(v as typeof panel)}>
          <TabsList className="w-full">
            <TabsTrigger value="links">Links</TabsTrigger>
            <TabsTrigger value="outline">Outline</TabsTrigger>
            <TabsTrigger value="tags">Tags</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {panel === 'links' && <LinksPanel path={path} />}
        {panel === 'outline' && <Outline headings={headings} onHeading={onHeading} />}
        {panel === 'tags' && <TagsPanel />}
      </div>
    </aside>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-[11px] font-medium tracking-wide text-subtle-foreground uppercase">{children}</p>
}

function LinksPanel({ path }: { path: string }) {
  const graph = useLinkGraph()
  const files = useVault((s) => s.files)
  const open = useOpenLink(path)
  const navigate = useNavigate()
  const backlinks = graph.backlinks(path)
  const outgoing = graph.outgoing(path).filter((o, i, all) => all.findIndex((x) => x.link.target.toLowerCase() === o.link.target.toLowerCase()) === i)

  const grouped = useMemo(() => {
    const map = new Map<string, typeof backlinks>()
    for (const ref of backlinks) map.set(ref.from, [...(map.get(ref.from) ?? []), ref])
    return [...map]
  }, [backlinks])

  const openPath = (p: string) => {
    const f = files.get(p)
    if (f?.kind === 'ticket') navigate(routes.ticket(String(f.frontmatter.key)))
    else void open(graph.resolver.linkText(p), { newTab: false })
  }

  return (
    <>
      <SectionLabel>Backlinks · {backlinks.length}</SectionLabel>
      {grouped.length === 0 && <p className="mb-4 text-xs text-subtle-foreground">No other notes link here.</p>}
      {grouped.map(([from, refs]) => {
        const f = files.get(from)
        return (
          <button key={from} className="mb-2 block w-full rounded-lg border px-2.5 py-2 text-left hover:border-border-strong hover:bg-accent" onClick={() => openPath(from)}>
            <div className="flex items-center gap-1.5 font-medium">
              {f?.kind === 'ticket' ? <Kanban className="size-3.5" /> : <FileText className="size-3.5" />}
              <span className="truncate">{f?.kind === 'ticket' ? `${f.frontmatter.key} · ${f.title}` : f?.title}</span>
            </div>
            {refs.slice(0, 3).map((r, i) => (
              <div key={i} className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
                {plainText(r.context)}
              </div>
            ))}
          </button>
        )
      })}
      <div className="mt-4">
        <SectionLabel>Outgoing · {outgoing.length}</SectionLabel>
        {outgoing.length === 0 && <p className="text-xs text-subtle-foreground">No links in this note.</p>}
        {outgoing.map(({ link, resolved }, i) => (
          <button
            key={i}
            className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => void open(link.target + (link.heading ? `#${link.heading}` : ''), { newTab: false })}
          >
            <Link2 className="size-3.5 shrink-0" />
            <span className="truncate">{link.target || '(this note)'}</span>
            {!resolved && <span className="ml-auto shrink-0 rounded-full border px-1.5 text-[10px] text-subtle-foreground">not created</span>}
          </button>
        ))}
      </div>
    </>
  )
}

function Outline({ headings, onHeading }: { headings: Heading[]; onHeading(h: Heading): void }) {
  if (!headings.length) return <p className="text-xs text-subtle-foreground">No headings.</p>
  const min = Math.min(...headings.map((h) => h.level))
  return (
    <nav>
      {headings.map((h, i) => (
        <button
          key={i}
          className="block w-full truncate rounded-md py-1 pr-2 text-left text-[12.5px] text-muted-foreground hover:bg-accent hover:text-foreground"
          style={{ paddingLeft: 8 + (h.level - min) * 12 }}
          onClick={() => onHeading(h)}
        >
          {h.text}
        </button>
      ))}
    </nav>
  )
}

function TagsPanel() {
  const files = useVault((s) => s.files)
  const navigate = useNavigate()
  const tags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const f of files.values()) for (const t of f.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [files])
  if (!tags.length) return <p className="text-xs text-subtle-foreground">No tags in this vault.</p>
  return (
    <div>
      {tags.map(([tag, count]) => (
        <button key={tag} className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-muted-foreground hover:bg-accent hover:text-foreground" onClick={() => navigate(`/search?q=${encodeURIComponent('#' + tag)}`)}>
          <Hash className="size-3.5 text-status-blue" />
          <span className="truncate">{tag}</span>
          <span className="ml-auto text-xs text-subtle-foreground">{count}</span>
        </button>
      ))}
    </div>
  )
}
