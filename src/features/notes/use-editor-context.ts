import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import type { EditorContext, LinkTarget } from '@/editor/link-context'
import { useLinkGraph } from '@/index/use-link-graph'
import { routes } from '@/lib/routes'
import { attachmentUrl, saveAttachment } from '@/services/attachments'
import { uniquePath, writeFile } from '@/services/vault-ops'
import { VAULT_DIRS } from '@/vault/config'
import { dirname, joinPath, stem } from '@/vault/paths'
import { useVault } from '@/vault/vault-store'
import { useNotesUi } from './notes-store'

/** Split `Note#Heading` / `Note^block` into the file part and the rest. */
export function splitTarget(target: string): { name: string; sub: string | null } {
  const i = target.search(/[#^]/)
  return i < 0 ? { name: target, sub: null } : { name: target.slice(0, i), sub: target.slice(i + 1) }
}

export function useOpenLink(fromPath: string | null) {
  const navigate = useNavigate()
  const graph = useLinkGraph()
  const openTab = useNotesUi((s) => s.openTab)

  return async (target: string, { newTab }: { newTab: boolean }) => {
    const { name } = splitTarget(target)
    const { files } = useVault.getState()
    let resolved = name.trim() ? graph.resolver.resolve(name, fromPath ?? undefined) : fromPath

    if (!resolved) {
      // Obsidian behaviour: following an unresolved link creates the note.
      try {
        const folder = fromPath && fromPath.startsWith(`${VAULT_DIRS.notes}/`) ? dirname(fromPath) : VAULT_DIRS.notes
        const clean = name.trim().replace(/\.md$/i, '')
        const path = await uniquePath(joinPath(clean.includes('/') ? VAULT_DIRS.notes : folder, `${clean}.md`))
        await writeFile(path, '')
        resolved = path
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not create note')
        return
      }
    }

    const file = files.get(resolved) ?? useVault.getState().files.get(resolved)
    if (file?.kind === 'ticket') {
      navigate(routes.ticket(String(file.frontmatter.key ?? stem(resolved))))
    } else if (file?.kind === 'note' || resolved.endsWith('.md')) {
      openTab(resolved, { newTab, replace: fromPath })
      navigate(routes.note(resolved))
    } else {
      const url = await attachmentUrl(resolved)
      if (url) window.open(url, '_blank', 'noopener')
    }
  }
}

export function useEditorContext(path: string | null): EditorContext {
  const graph = useLinkGraph()
  const files = useVault((s) => s.files)
  const openLink = useOpenLink(path)

  return useMemo<EditorContext>(() => {
    let targets: LinkTarget[] | null = null
    return {
      path,
      resolve: (target) => graph.resolver.resolve(splitTarget(target).name, path ?? undefined),
      targets() {
        targets ??= [...files.values()]
          .filter((f) => f.kind !== 'other' && f.path !== path)
          .map((f) => ({
            label: graph.resolver.linkText(f.path),
            detail: f.kind === 'ticket' ? f.title : dirname(f.path),
            kind: f.kind as LinkTarget['kind'],
          }))
          .sort((a, b) => (a.kind === b.kind ? a.label.localeCompare(b.label) : a.kind === 'note' ? -1 : b.kind === 'note' ? 1 : 0))
        return targets
      },
      openLink: (target, opts) => void openLink(target, opts),
      loadImage: attachmentUrl,
      saveFile: (file) => saveAttachment(file),
    }
    // openLink is recreated every render; the context only needs to change with the data it reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, graph, path])
}
