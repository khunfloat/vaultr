import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Kbd } from '@/components/ui/kbd'
import { SHORTCUTS } from './shortcuts'
import { useUi } from './ui-store'

export function ShortcutsDialog() {
  const open = useUi((s) => s.shortcutsOpen)
  const setOpen = useUi((s) => s.setShortcutsOpen)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex items-center justify-between border-b py-2 last:border-0">
              <span className="text-muted-foreground">{s.action}</span>
              <Kbd>{s.keys}</Kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
