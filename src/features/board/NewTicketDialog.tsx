import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createTicket, type Ticket } from '@/services/tickets'
import { PRIORITIES, PRIORITY_LABEL, type Priority, STATUS_LABEL, TICKET_STATUSES, type TicketStatus } from './ticket-meta'
import { DeadlinePicker } from './DeadlinePicker'

export function NewTicketDialog({ open, onOpenChange, defaultStatus = 'todo', onCreated }: { open: boolean; onOpenChange(open: boolean): void; defaultStatus?: TicketStatus; onCreated(t: Ticket): void }) {
  const [title, setTitle] = useState('')
  const [status, setStatus] = useState<TicketStatus>(defaultStatus)
  const [priority, setPriority] = useState<Priority>('medium')
  const [deadline, setDeadline] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setBusy(true)
    try {
      const t = await createTicket({ title, status, priority, deadline })
      setTitle('')
      setDeadline(null)
      onOpenChange(false)
      onCreated(t)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create ticket')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setStatus(defaultStatus)
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>New ticket</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="ticket-title">Title</Label>
            <Input id="ticket-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to be done?" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TicketStatus)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Deadline</Label>
              <DeadlinePicker value={deadline} onChange={setDeadline} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !title.trim()}>
              Create ticket
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
