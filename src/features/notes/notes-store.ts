import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface NotesUiState {
  tabs: string[]
  mode: 'live' | 'source' | 'reading'
  rightPanel: 'links' | 'outline' | 'tags'
  rightPanelOpen: boolean
  /** Expanded folders in the file tree. */
  expanded: string[]
  /** Tree node currently being renamed inline (not persisted). */
  renaming: string | null
  /** Folder new notes/folders go into: the last folder clicked or the folder of the open note. */
  currentFolder: string
  /** Path being moved via the "Move to…" dialog (not persisted). */
  moving: string | null
  setCurrentFolder(folder: string): void
  setMoving(path: string | null): void
  setExpanded(update: string[] | ((prev: string[]) => string[])): void
  setRenaming(path: string | null): void
  openTab(path: string, opts?: { newTab?: boolean; replace?: string | null }): void
  closeTab(path: string): string | null
  renameTab(from: string, to: string): void
  setMode(mode: NotesUiState['mode']): void
  setRightPanel(panel: NotesUiState['rightPanel']): void
  toggleRightPanel(): void
}

/** Open note tabs and view preferences. Persisted per browser via localStorage. */
export const useNotesUi = create<NotesUiState>()(
  persist(
    (set, get) => ({
      tabs: [],
      mode: 'live',
      rightPanel: 'links',
      rightPanelOpen: true,
      expanded: [],
      renaming: null,
      currentFolder: 'notes',
      moving: null,
      setCurrentFolder: (currentFolder) => set({ currentFolder }),
      setMoving: (moving) => set({ moving }),

      setExpanded: (update) => set({ expanded: typeof update === 'function' ? update(get().expanded) : update }),
      setRenaming: (renaming) => set({ renaming }),
      openTab(path, { newTab = false, replace = null } = {}) {
        const tabs = get().tabs
        if (tabs.includes(path)) return
        if (!newTab && replace && tabs.includes(replace)) {
          set({ tabs: tabs.map((t) => (t === replace ? path : t)) })
        } else {
          set({ tabs: [...tabs, path].slice(-12) })
        }
      },
      closeTab(path) {
        const tabs = get().tabs
        const i = tabs.indexOf(path)
        const next = tabs.filter((t) => t !== path)
        set({ tabs: next })
        return next[Math.min(i, next.length - 1)] ?? null
      },
      renameTab(from, to) {
        set({ tabs: get().tabs.map((t) => (t === from ? to : t)) })
      },
      setMode: (mode) => set({ mode }),
      setRightPanel: (rightPanel) => set({ rightPanel, rightPanelOpen: true }),
      toggleRightPanel: () => set({ rightPanelOpen: !get().rightPanelOpen }),
    }),
    {
      name: 'vaultr:notes-ui',
      partialize: ({ tabs, mode, rightPanel, rightPanelOpen, expanded, currentFolder }) => ({ tabs, mode, rightPanel, rightPanelOpen, expanded, currentFolder }),
    },
  ),
)
