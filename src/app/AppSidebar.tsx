import { ChevronsUpDown, CornerDownRight, FilePlus, FileText, FolderPlus, FolderX, Kanban, RefreshCw, Search } from 'lucide-react'
import { useMemo } from 'react'
import { NavLink, useLocation } from 'react-router'
import { AppLogo } from '@/components/AppLogo'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Kbd } from '@/components/ui/kbd'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { FileTree } from '@/features/notes/FileTree'
import { useNotesRootActions } from '@/features/notes/use-tree-actions'
import { formatRelative } from '@/lib/format'
import { routes } from '@/lib/routes'
import { useNow } from '@/lib/use-now'
import { useVault } from '@/vault/vault-store'
import { useUi } from './ui-store'

export function AppSidebar() {
  const { pathname } = useLocation()
  const files = useVault((s) => s.files)
  const openTickets = useMemo(
    () => [...files.values()].filter((f) => f.kind === 'ticket' && f.frontmatter.status !== 'done').length,
    [files],
  )
  const setSwitcherOpen = useUi((s) => s.setSwitcherOpen)
  const rootActions = useNotesRootActions()
  const readOnly = useVault((s) => s.status !== 'ready')

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader>
        <VaultSwitcher />
      </SidebarHeader>
      <SidebarContent className="gap-0">
        <SidebarGroup className="py-1">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/board')}>
                <NavLink to={routes.board()}>
                  <Kanban /> Board
                </NavLink>
              </SidebarMenuButton>
              {openTickets > 0 && <SidebarMenuBadge>{openTickets}</SidebarMenuBadge>}
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/notes')}>
                <NavLink to={routes.notes()}>
                  <FileText /> Notes
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/search')}>
                <NavLink to="/search">
                  <Search /> Search
                  <Kbd className="ml-auto">Ctrl ⇧ F</Kbd>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => setSwitcherOpen(true)}>
                <CornerDownRight /> Quick open
                <Kbd className="ml-auto">Ctrl O</Kbd>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup className="relative min-h-0 flex-1 p-0">
          <SidebarGroupLabel className="px-4 uppercase tracking-wide text-subtle-foreground">Notes</SidebarGroupLabel>
          {!readOnly && (
            <div className="absolute top-1.5 right-2 flex gap-0.5">
              <SidebarGroupAction className="static" title={`New note in ${folderLabel(rootActions.folder)}`} aria-label="New note" onClick={() => void rootActions.newNote()}>
                <FilePlus />
              </SidebarGroupAction>
              <SidebarGroupAction className="static" title={`New folder in ${folderLabel(rootActions.folder)}`} aria-label="New folder" onClick={() => void rootActions.newFolder()}>
                <FolderPlus />
              </SidebarGroupAction>
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-auto">
            <FileTree />
          </div>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t">
        <SaveStatus />
      </SidebarFooter>
    </Sidebar>
  )
}

function folderLabel(folder: string) {
  return folder === 'notes' ? 'Notes' : folder.replace(/^notes\//, '')
}

function VaultSwitcher() {
  const { name, status, rescan, closeVault } = useVault()
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg">
              <AppLogo className="size-7" />
              <div className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate font-semibold">{name}</span>
                <span className="truncate text-[11px] text-subtle-foreground">Local folder</span>
              </div>
              <ChevronsUpDown className="size-4 text-subtle-foreground" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width) min-w-56">
            <DropdownMenuLabel className="text-xs text-subtle-foreground">Vault</DropdownMenuLabel>
            <DropdownMenuItem disabled={status !== 'ready'} onSelect={() => void rescan()}>
              <RefreshCw /> Rescan folder
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void closeVault()}>
              <FolderX /> Close vault
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function SaveStatus() {
  const status = useVault((s) => s.status)
  const lastScanAt = useVault((s) => s.lastScanAt)
  const now = useNow()
  const ready = status === 'ready'
  return (
    <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
      <span className={ready ? 'size-1.75 rounded-full bg-status-green shadow-[0_0_0_3px] shadow-status-green/15' : 'size-1.75 rounded-full bg-status-amber'} />
      {ready ? `Synced with disk · ${lastScanAt ? formatRelative(lastScanAt, now) : '—'}` : 'Read-only (locked)'}
    </div>
  )
}
