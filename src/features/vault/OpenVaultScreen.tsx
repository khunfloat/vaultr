import { FolderOpen, Lock, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { AppLogo } from '@/components/AppLogo'
import { Button } from '@/components/ui/button'
import { useVault } from '@/vault/vault-store'

export function OpenVaultScreen() {
  const status = useVault((s) => s.status)
  const openFolder = useVault((s) => s.openFolder)
  const error = useVault((s) => s.error)
  const [busy, setBusy] = useState(false)

  const onOpen = async () => {
    setBusy(true)
    try {
      await openFolder()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid h-full place-items-center bg-[radial-gradient(ellipse_at_50%_0%,rgb(255_255_255/5%),transparent_60%)] p-6">
      <div className="w-full max-w-[440px] rounded-xl border bg-card p-7">
        <div className="flex items-center gap-2.5">
          <AppLogo className="size-10" />
          <span className="text-base font-semibold tracking-tight">Vaultr</span>
        </div>
        <h1 className="mt-4 mb-1 text-lg font-semibold">Open a vault</h1>
        <p className="mb-5 text-muted-foreground">
          A vault is a folder on your computer. Notes and tickets are saved there as plain <code className="font-mono">.md</code>{' '}
          files, so you can also open them in Obsidian.
        </p>

        {status === 'unsupported' ? (
          <Notice icon={<TriangleAlert className="size-4" />}>
            This browser can’t access folders. Open <b>vaultr.html</b> in Microsoft Edge or Google Chrome.
          </Notice>
        ) : (
          <Button className="w-full" onClick={onOpen} disabled={busy || status === 'connecting'}>
            <FolderOpen /> {status === 'connecting' ? 'Opening…' : 'Choose folder…'}
          </Button>
        )}

        {error && <Notice icon={<TriangleAlert className="size-4" />}>{error}</Notice>}

        <p className="mt-4 flex gap-2 text-xs text-subtle-foreground">
          <Lock className="mt-0.5 size-3.5 shrink-0" />
          Tip: create an empty folder such as Documents\VaultrData. Edge will ask for access once per session.
        </p>
      </div>
    </div>
  )
}

function Notice({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mt-4 flex gap-2 rounded-lg bg-status-amber/12 px-3 py-2.5 text-xs text-status-amber">
      <span className="mt-px">{icon}</span>
      <span>{children}</span>
    </div>
  )
}
