import { useEffect, useMemo, useRef } from 'react'
import { renderMarkdown } from '@/markdown/render'
import { cn } from '@/lib/utils'
import type { EditorContext } from './link-context'

/** Read-only rendered markdown (reading mode). */
export function MarkdownView({ source, context, className, onToggleTask }: { source: string; context: EditorContext; className?: string; onToggleTask?(line: number): void }) {
  const ref = useRef<HTMLDivElement>(null)
  const html = useMemo(() => renderMarkdown(source, { resolve: context.resolve }), [source, context])

  useEffect(() => {
    const root = ref.current
    if (!root) return
    for (const img of root.querySelectorAll<HTMLImageElement>('img[data-vault-src]')) {
      void context.loadImage(img.dataset.vaultSrc!).then((url) => {
        if (url) img.src = url
        else img.replaceWith(Object.assign(document.createElement('span'), { className: 'md-missing', textContent: `Missing: ${img.dataset.vaultSrc}` }))
      })
    }
    // Task checkboxes: map the nth checkbox to the nth task line in the source.
    const taskLines = source.split('\n').flatMap((l, i) => (/^\s*(?:[-*+]|\d+[.)])\s+\[[ xX]\]/.test(l) ? [i] : []))
    root.querySelectorAll<HTMLInputElement>('input.task-list-item-checkbox').forEach((box, i) => {
      box.disabled = !onToggleTask
      box.onclick = (e) => {
        e.preventDefault()
        if (taskLines[i] !== undefined) onToggleTask?.(taskLines[i])
      }
    })
  }, [html, context, source, onToggleTask])

  const onClick = (e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-target]')
    if (!el) return
    e.preventDefault()
    context.openLink(el.dataset.target!, { newTab: e.ctrlKey || e.metaKey })
  }

  return <div ref={ref} className={cn('md-prose', className)} onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />
}
