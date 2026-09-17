import { useMemo } from 'react'
import { useVault } from '@/vault/vault-store'
import { buildLinkGraph } from './link-graph'

export function useLinkGraph() {
  const files = useVault((s) => s.files)
  return useMemo(() => buildLinkGraph(files), [files])
}
