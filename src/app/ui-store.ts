import { create } from 'zustand'
import type { TicketStatus } from '@/features/board/ticket-meta'

interface UiState {
  switcherOpen: boolean
  shortcutsOpen: boolean
  /** Column for the "New ticket" dialog, or null when closed. */
  newTicket: TicketStatus | null
  setSwitcherOpen(open: boolean): void
  setShortcutsOpen(open: boolean): void
  setNewTicket(status: TicketStatus | null): void
}

export const useUi = create<UiState>()((set) => ({
  switcherOpen: false,
  shortcutsOpen: false,
  newTicket: null,
  setSwitcherOpen: (switcherOpen) => set({ switcherOpen }),
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  setNewTicket: (newTicket) => set({ newTicket }),
}))
