import { SidebarTrigger } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

export function PageHeader({ children, actions, className }: { children: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <header className={cn('flex h-13 shrink-0 items-center gap-2 border-b px-3', className)}>
      <SidebarTrigger className="text-muted-foreground" />
      <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground [&_b]:font-medium [&_b]:text-foreground">{children}</div>
      <div className="ml-auto flex items-center gap-2">{actions}</div>
    </header>
  )
}
