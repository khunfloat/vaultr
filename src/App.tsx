import { Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { RouterProvider } from 'react-router'
import { router } from '@/app/router'
import { OpenVaultScreen } from '@/features/vault/OpenVaultScreen'
import { useVault } from '@/vault/vault-store'

export default function App() {
  const status = useVault((s) => s.status)

  useEffect(() => {
    const vault = useVault.getState()
    if (import.meta.env.DEV) Object.assign(window, { __vault: useVault })
    const mode = import.meta.env.DEV ? new URLSearchParams(location.search).get('fs') : null
    if (mode === 'memory') {
      void import('@/dev/fixture-vault').then(({ createFixtureVault }) => vault.attach(createFixtureVault()))
    } else if (mode === 'demo') {
      void import('@/dev/demo-vault').then(({ createDemoVault }) => vault.attach(createDemoVault()))
    } else {
      void vault.init()
    }
  }, [])

  switch (status) {
    case 'loading':
    case 'connecting':
      return (
        <div className="grid h-full place-items-center text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      )
    case 'unsupported':
    case 'no-vault':
    case 'error':
      return <OpenVaultScreen />
    case 'locked':
    case 'ready':
      return <RouterProvider router={router} />
  }
}
