import { format } from 'date-fns'
import { CalendarDays, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatDate, parseDate } from '@/lib/dates'
import { cn } from '@/lib/utils'

export function DeadlinePicker({ value, onChange, className, disabled }: { value: string | null; onChange(v: string | null): void; className?: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const date = parseDate(value) ?? undefined
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <Button type="button" variant="outline" className={cn('w-full justify-start font-normal', !value && 'text-muted-foreground', className)}>
          <CalendarDays />
          <span className="truncate">{value ? formatDate(value) : 'None'}</span>
          {value && (
            <span
              role="button"
              tabIndex={-1}
              className="ml-auto rounded p-0.5 opacity-60 hover:bg-accent hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation()
                onChange(null)
              }}
              aria-label="Clear deadline"
            >
              <X className="size-3" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          weekStartsOn={1}
          selected={date}
          defaultMonth={date}
          onSelect={(d) => {
            onChange(d ? format(d, 'yyyy-MM-dd') : null)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
