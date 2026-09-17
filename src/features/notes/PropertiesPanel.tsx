import { ChevronRight, Plus, TriangleAlert, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { FrontmatterData } from '@/markdown/frontmatter'
import { useStoredState } from '@/lib/use-stored-state'
import { cn } from '@/lib/utils'

/** Obsidian-style "Properties" editor for frontmatter. Lists become comma-separated text. */
export function PropertiesPanel({ data, error, readOnly, onPatch }: { data: FrontmatterData; error: string | null; readOnly: boolean; onPatch(patch: FrontmatterData): void }) {
  const [open, setOpen] = useStoredState('vaultr:properties-open', true)
  const [adding, setAdding] = useState(false)
  const entries = Object.entries(data)

  if (error) {
    return (
      <div className="mb-5 flex gap-2 rounded-lg border border-status-amber/25 bg-status-amber/10 px-3 py-2 text-xs text-status-amber">
        <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
        <span>Properties can’t be read (invalid YAML: {error}). Switch to Source mode to fix it — the app won’t change it.</span>
      </div>
    )
  }
  if (!entries.length && !adding) {
    return readOnly ? null : (
      <button className="mb-3 flex items-center gap-1 text-xs text-subtle-foreground hover:text-foreground" onClick={() => setAdding(true)}>
        <Plus className="size-3.5" /> Add property
      </button>
    )
  }

  return (
    <div className="mb-5 rounded-lg border px-3 py-1.5">
      <button className="flex w-full items-center gap-1.5 py-1 text-xs text-subtle-foreground" onClick={() => setOpen(!open)}>
        <ChevronRight className={cn('size-3.5 transition-transform', open && 'rotate-90')} /> Properties
      </button>
      {open && (
        <div className="pb-1">
          {entries.map(([key, value]) => (
            <PropertyRow key={key} name={key} value={value} readOnly={readOnly} onChange={(v) => onPatch({ [key]: v })} onRemove={() => onPatch({ [key]: undefined })} />
          ))}
          {adding ? (
            <NewProperty
              existing={Object.keys(data)}
              onDone={(k, v) => {
                setAdding(false)
                if (k) onPatch({ [k]: v })
              }}
            />
          ) : (
            !readOnly && (
              <button className="mt-1 flex items-center gap-1 py-1 text-xs text-subtle-foreground hover:text-foreground" onClick={() => setAdding(true)}>
                <Plus className="size-3.5" /> Add property
              </button>
            )
          )}
        </div>
      )}
    </div>
  )
}

function toText(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ')
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function fromText(text: string, previous: unknown): unknown {
  if (Array.isArray(previous)) return text.split(',').map((s) => s.trim()).filter(Boolean)
  if (typeof previous === 'number' && text.trim() !== '' && !Number.isNaN(Number(text))) return Number(text)
  if (typeof previous === 'boolean') return text.trim() === 'true'
  return text
}

function PropertyRow({ name, value, readOnly, onChange, onRemove }: { name: string; value: unknown; readOnly: boolean; onChange(v: unknown): void; onRemove(): void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const text = draft ?? toText(value)
  const isObject = typeof value === 'object' && value !== null && !Array.isArray(value)
  const commit = () => {
    if (draft !== null && draft !== toText(value)) onChange(fromText(draft, value))
    setDraft(null)
  }
  return (
    <div className="group grid min-h-8 grid-cols-[120px_1fr_auto] items-center gap-2">
      <span className="truncate text-muted-foreground" title={name}>
        {name}
      </span>
      {Array.isArray(value) && draft === null ? (
        <button className="flex min-h-7 flex-wrap items-center gap-1 rounded-md px-1.5 text-left hover:bg-accent" disabled={readOnly} onClick={() => setDraft(toText(value))}>
          {value.length ? value.map((v, i) => <span key={i} className="rounded-full bg-status-blue/12 px-2 text-xs leading-5 text-status-blue">{String(v)}</span>) : <span className="text-subtle-foreground">Empty</span>}
        </button>
      ) : (
        <input
          className="h-7 rounded-md bg-transparent px-1.5 outline-none hover:bg-accent focus:bg-accent disabled:opacity-60"
          value={text}
          disabled={readOnly || isObject}
          autoFocus={draft !== null && Array.isArray(value)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'Escape') setDraft(null)
          }}
        />
      )}
      {!readOnly && (
        <Button variant="ghost" size="icon-xs" className="opacity-0 group-hover:opacity-100" onClick={onRemove} aria-label={`Remove ${name}`}>
          <X />
        </Button>
      )}
    </div>
  )
}

function NewProperty({ existing, onDone }: { existing: string[]; onDone(key: string | null, value: string): void }) {
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const valid = /^[\p{L}\p{N}_-]+$/u.test(key) && !existing.includes(key)
  const submit = () => onDone(valid ? key : null, value)
  return (
    <div className="grid grid-cols-[120px_1fr_auto] items-center gap-2 py-1">
      <Input autoFocus className="h-7" placeholder="name" value={key} onChange={(e) => setKey(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && onDone(null, '')} />
      <Input className="h-7" placeholder="value" value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onDone(null, '') }} />
      <Button size="xs" variant="outline" disabled={!valid} onClick={submit}>
        Add
      </Button>
    </div>
  )
}
