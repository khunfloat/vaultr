import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useVault } from '@/vault/vault-store'

export function ReconnectBanner() {
  const status = useVault((s) => s.status)
  const reconnect = useVault((s) => s.reconnect)
  if (status !== 'locked') return null
  return (
    <div className="flex items-center gap-2.5 border-b border-status-amber/20 bg-status-amber/12 px-4 py-2 text-[12.5px] text-status-amber">
      <Lock className="size-3.5" />
      Vault is locked. Showing cached data — changes can’t be saved until you reconnect.
      <Button size="sm" variant="outline" className="ml-auto border-status-amber/35 text-foreground" onClick={() => void reconnect()}>
        Reconnect vault
      </Button>
    </div>
  )
}
