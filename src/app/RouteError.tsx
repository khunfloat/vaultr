import { TriangleAlert } from 'lucide-react'
import { isRouteErrorResponse, useRouteError } from 'react-router'
import { Button } from '@/components/ui/button'

export function RouteError() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : error instanceof Error ? error.message : String(error)
  return (
    <div className="grid h-full place-items-center p-6">
      <div className="max-w-md rounded-xl border bg-card p-6">
        <div className="flex items-center gap-2 font-semibold text-status-red">
          <TriangleAlert className="size-4" /> Something went wrong
        </div>
        <pre className="mt-3 max-h-60 overflow-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap">{message}</pre>
        <p className="mt-3 text-muted-foreground">Your files are safe — nothing is written when the app crashes.</p>
        <Button className="mt-4" variant="outline" onClick={() => location.reload()}>
          Reload app
        </Button>
      </div>
    </div>
  )
}
