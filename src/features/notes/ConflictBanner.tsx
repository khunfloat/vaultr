import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ConflictBanner({ onReload, onKeepMine }: { onReload(): void; onKeepMine(): void }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-status-amber/20 bg-status-amber/12 px-4 py-2 text-[12.5px] text-status-amber">
      <TriangleAlert className="size-3.5 shrink-0" />
      This file changed on disk while you were editing.
      <div className="ml-auto flex gap-2">
        <Button size="sm" variant="outline" className="border-status-amber/35 text-foreground" onClick={onReload}>
          Reload from disk
        </Button>
        <Button size="sm" variant="outline" className="border-status-amber/35 text-foreground" onClick={onKeepMine}>
          Keep my version
        </Button>
      </div>
    </div>
  )
}
