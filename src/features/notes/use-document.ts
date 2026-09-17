import { useCallback, useEffect, useRef, useState } from 'react'
import { parseMarkdown, replaceBody, updateFrontmatter, type FrontmatterData } from '@/markdown/frontmatter'
import { ConflictError } from '@/services/errors'
import { readFile, writeFile } from '@/services/vault-ops'
import { useVault } from '@/vault/vault-store'

const SAVE_DELAY = 600

export type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

export interface DocumentHandle {
  status: 'loading' | 'ready' | 'missing'
  /** Bumps whenever content is (re)loaded from disk; use it in the editor `key`. */
  version: number
  body: string
  frontmatter: FrontmatterData
  frontmatterError: string | null
  save: SaveState
  error: string | null
  conflict: boolean
  setBody(body: string): void
  patchFrontmatter(patch: FrontmatterData): Promise<void>
  flush(): Promise<void>
  resolveConflict(choice: 'reload' | 'keep-mine'): Promise<void>
}

/**
 * Load a markdown file, save body edits with a debounce, and reconcile with external changes.
 * The file on disk is the source of truth: every write carries the mtime we last saw.
 */
export function useDocument(path: string | null): DocumentHandle {
  const [status, setStatus] = useState<DocumentHandle['status']>('loading')
  const [version, setVersion] = useState(0)
  const [body, setBodyState] = useState('')
  const [frontmatter, setFrontmatter] = useState<FrontmatterData>({})
  const [frontmatterError, setFrontmatterError] = useState<string | null>(null)
  const [save, setSave] = useState<SaveState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [conflict, setConflictState] = useState(false)

  const text = useRef('')
  const mtime = useRef(0)
  const pendingBody = useRef<string | null>(null)
  const timer = useRef<number | null>(null)
  const writing = useRef<Promise<void> | null>(null)
  const pathRef = useRef(path)
  const conflictRef = useRef(false)
  const setConflict = useCallback((v: boolean) => {
    conflictRef.current = v
    setConflictState(v)
  }, [])
  /** True while our own write is in flight, so the index update it triggers isn't mistaken for an external edit. */
  const savingRef = useRef(false)

  const applyText = useCallback((t: string, m: number) => {
    text.current = t
    mtime.current = m
    const parsed = parseMarkdown(t)
    setBodyState(parsed.body)
    setFrontmatter(parsed.data)
    setFrontmatterError(parsed.error)
  }, [])

  const load = useCallback(async () => {
    const p = pathRef.current
    if (!p) return
    try {
      const { text: t, mtime: m } = await readFile(p)
      if (pathRef.current !== p) return
      applyText(t, m)
      pendingBody.current = null
      setConflict(false)
      setError(null)
      setSave('idle')
      setStatus('ready')
      setVersion((v) => v + 1)
    } catch {
      if (pathRef.current === p) setStatus('missing')
    }
  }, [applyText, setConflict])

  const write = useCallback(
    async (next: string, opts: { force?: boolean } = {}) => {
      const p = pathRef.current
      if (!p) return
      setSave('saving')
      savingRef.current = true
      try {
        const stat = await writeFile(p, next, opts.force ? {} : { expectedMtime: mtime.current })
        if (pathRef.current !== p) return
        text.current = next
        mtime.current = stat.mtime
        setSave('saved')
        setError(null)
      } catch (e) {
        if (e instanceof ConflictError) {
          setConflict(true)
          setSave('error')
        } else {
          setError(e instanceof Error ? e.message : String(e))
          setSave('error')
        }
        throw e
      } finally {
        savingRef.current = false
      }
    },
    [setConflict],
  )

  const flush = useCallback(async () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
    await writing.current?.catch(() => {})
    const pending = pendingBody.current
    if (pending === null || conflictRef.current) return
    pendingBody.current = null
    const next = replaceBody(text.current, pending)
    if (next === text.current) {
      setSave('saved')
      return
    }
    writing.current = write(next).catch(() => {
      // Keep the unsaved body so a retry or "keep mine" can still write it.
      pendingBody.current ??= pending
    })
    await writing.current
  }, [write])

  const setBody = useCallback(
    (next: string) => {
      pendingBody.current = next
      setBodyState(next)
      setSave('pending')
      if (timer.current !== null) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => void flush(), SAVE_DELAY)
    },
    [flush],
  )

  const patchFrontmatter = useCallback(
    async (patch: FrontmatterData) => {
      await flush()
      const base = pendingBody.current !== null ? replaceBody(text.current, pendingBody.current) : text.current
      const next = updateFrontmatter(base, patch)
      pendingBody.current = null
      await write(next).catch(() => {})
      setFrontmatter(parseMarkdown(text.current).data)
    },
    [flush, write],
  )

  const resolveConflict = useCallback(
    async (choice: 'reload' | 'keep-mine') => {
      if (choice === 'reload') return load()
      const pending = pendingBody.current ?? body
      const { text: disk } = await readFile(pathRef.current!)
      setConflict(false)
      pendingBody.current = null
      await write(replaceBody(disk, pending), { force: true }).catch(() => {})
    },
    [body, load, write, setConflict],
  )

  // Load on path change; flush the previous file first.
  useEffect(() => {
    pathRef.current = path
    void load()
    return () => {
      void flush()
    }
  }, [path, load, flush])

  // External changes: reload silently when clean, flag a conflict when there are unsaved edits.
  useEffect(() => {
    if (!path) return
    return useVault.subscribe((s, prev) => {
      const now = s.files.get(path)
      const before = prev.files.get(path)
      if (now === before) return
      if (!now) {
        if (pendingBody.current === null) setStatus('missing')
        return
      }
      if (now.mtime === mtime.current || savingRef.current) return
      if (pendingBody.current !== null) setConflict(true)
      else void load()
    })
  }, [path, load, setConflict])

  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingBody.current !== null) {
        void flush()
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [flush])

  return { status, version, body, frontmatter, frontmatterError, save, error, conflict, setBody, patchFrontmatter, flush, resolveConflict }
}
