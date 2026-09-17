import { Outlet } from 'react-router'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ReconnectBanner } from '@/features/vault/ReconnectBanner'
import { MoveToFolderDialog } from '@/features/notes/MoveToFolderDialog'
import { QuickSwitcher } from '@/features/search/QuickSwitcher'
import { AppSidebar } from './AppSidebar'
import { GlobalShortcuts } from './GlobalShortcuts'
import { ShortcutsDialog } from './ShortcutsDialog'

export function AppShell() {
  return (
    <TooltipProvider delayDuration={300}>
      <SidebarProvider className="h-full min-h-0">
        <AppSidebar />
        <SidebarInset className="flex min-h-0 min-w-0 flex-col">
          <ReconnectBanner />
          <Outlet />
        </SidebarInset>
        <QuickSwitcher />
        <ShortcutsDialog />
        <MoveToFolderDialog />
        <GlobalShortcuts />
        <Toaster position="bottom-right" />
      </SidebarProvider>
    </TooltipProvider>
  )
}
