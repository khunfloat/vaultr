# Vaultr — Design & implementation notes

> Historical design document from the first build (M0–M6). The code is the source of truth; see the README for the current feature set.

Local-first Kanban + Obsidian-style notes. Runs as a single `vaultr.html` opened via `file://` in Edge on a locked-down Windows PC. Dark theme only. Design reference: `design/mockup.html`.

## 1. Principles

1. **Vault folder is the source of truth.** Notes and tickets are plain `.md` files. IndexedDB is only a cache/index plus the stored folder handle. Deleting IndexedDB loses nothing.
2. **Single file, fully offline.** No CDN, no server, no runtime fetch. Everything inlined by `vite-plugin-singlefile`; code splitting disabled.
3. **Obsidian-compatible.** A vault opened in real Obsidian should look right: wikilinks, frontmatter, `attachments/`.
4. **Storage behind an interface.** All file access goes through `VaultFs`. Real impl = File System Access API; test impl = in-memory. UI never touches handles directly.
5. **Ship every milestone.** Each milestone ends with a `vaultr.html` tested on the target PC.

## 2. Verified environment (2026-09-17)

Edge 153, `file://`, `isSecureContext: true`. Pass: inline ES modules, IndexedDB across log off, `showSaveFilePicker`, `showDirectoryPicker`, subfolders, UTF-8 Thai, binary write, 500-file scan, `lastModified` change detection, folder handle reuse after log off (needs one permission click per session). `navigator.storage.persist()` = false (irrelevant: data lives in the folder).

## 3. Stack

| Concern | Choice | Notes |
|---|---|---|
| Build | Vite + `vite-plugin-singlefile` | `build.assetsInlineLimit` max, `inlineDynamicImports: true` |
| UI | React 19 + TypeScript (strict) | |
| Styling | Tailwind v4 + shadcn/ui (neutral, dark only) | tokens from mockup |
| Icons | lucide-react | tree-shaken, inlined |
| Routing | react-router `HashRouter` | `#/board`, `#/notes/<path>` |
| State | Zustand | vault status, open tabs, UI state |
| Cache/index | Dexie (IndexedDB) | file index + handle store |
| Drag & drop | dnd-kit | board columns + cards |
| Ordering | `fractional-indexing` | no renumbering on drop |
| Editor | CodeMirror 6 + `@codemirror/lang-markdown` | custom Live Preview decorations |
| Reading view | markdown-it + footnote/task-list plugins | shared by ticket + note |
| Frontmatter | `yaml` | preserves unknown keys; no `gray-matter` (needs Buffer) |
| Search | MiniSearch | built from index at startup |
| Dates | date-fns | |
| Validation | zod | frontmatter + config |
| Tests | Vitest (unit), Playwright on Mac (e2e with in-memory FS) | |
| Font | system default | Segoe UI / Leelawadee UI / Cascadia Code |

## 4. Vault layout & file formats

```
<Vault>/
  notes/                    free-form .md, any folder depth
  tickets/TD-12.md          one file per ticket; filename = key (stable)
  attachments/              pasted/dropped files
  .vaultr/config.json      { version, ticketPrefix, nextTicketNumber, columns }
```

Ticket file:
```md
---
key: TD-12
title: Fix login timeout on SSO callback
status: in-progress        # todo | in-progress | done
priority: urgent           # urgent | high | medium | low
deadline: 2026-09-15       # optional, ISO date
labels: [bug, auth]
order: "a0V"               # fractional index within column
created: 2026-09-11T09:02:00+07:00
updated: 2026-09-17T10:40:00+07:00
done: null                 # set when moved to done
---
## Context
…markdown body, [[wikilinks]], ![[attachments/x.png]]
```

Rules:
- Unknown frontmatter keys are preserved on write.
- Next ticket number = `max(config.nextTicketNumber, highest existing TD-n + 1)` — survives manual file copies.
- Attachments named `attachments/<yyyyMMdd-HHmmss>-<slug>.<ext>`, inserted as `![[attachments/…]]`.
- Link resolution follows Obsidian: exact path → unique basename → shortest path. Tickets resolvable by key (`[[TD-12]]`).

## 5. Architecture

```
┌ features/board ─ features/notes ─ features/search ┐   React views
├──────────── editor/ (CM6) · markdown/ render ─────┤   shared markdown
├──────── services/  tickets · notes · attachments ─┤   business rules, serialize md
├──────── index/  indexer · link graph · search ────┤   derived data (Dexie + memory)
├──────── vault/  VaultFs · handle-store · watcher ─┤   file system boundary
└──────── File System Access API | MemoryFs (tests) ┘
```

```
src/
  app/            App.tsx, router.tsx, AppShell (sidebar, topbar), providers
  components/ui/  shadcn components
  vault/
    vault-fs.ts         interface: list, read, readBytes, write, writeBytes, move, remove, stat
    fsa-fs.ts           File System Access implementation (atomic-ish write, mkdir -p)
    memory-fs.ts        in-memory implementation for tests/dev
    handle-store.ts     persist/restore directory handle in IndexedDB
    vault-store.ts      Zustand: status (none|locked|ready|error), config
    watcher.ts          poll mtimes every 3s + on window focus
  index/
    db.ts               Dexie schema: files(path, kind, mtime, size, title, fm, links, tags, headings)
    indexer.ts          full scan on connect, re-parse only changed mtimes
    link-graph.ts       outgoing/backlinks, unresolved links
    search.ts           MiniSearch over titles + bodies
  markdown/
    frontmatter.ts      parse/serialize, preserve key order + unknown keys
    extract.ts          wikilinks, tags, headings, tasks
    resolve.ts          Obsidian-style link resolution
    render.ts           markdown-it + wikilink/tag/embed-image plugins
  editor/
    MarkdownEditor.tsx
    live-preview.ts     hide syntax off the active line; headings, bold, links, tasks, images
    wikilink-complete.ts `[[` autocomplete from index
    paste-files.ts      paste/drop → attachments/ → insert embed
    keymap.ts
  services/
    tickets.ts          create, update fields, move (status + order), delete
    notes.ts            create, rename (+ update backlinks), move, delete
    attachments.ts
  features/
    board/              BoardView, Column, TicketCard, TicketDialog, BoardFilters
    notes/              NotesView, FileTree, NoteTabs, NoteEditor, RightPanel (Links, Outline, Tags)
    search/             QuickSwitcher (Ctrl+O), CommandPalette (Ctrl+K, Phase B)
    vault/              OpenVaultScreen, ReconnectBanner
  lib/                  dates, debounce, ids, keyboard
```

### Key flows

**Startup**
1. Load handle from IndexedDB. None → `OpenVaultScreen`.
2. `queryPermission` = granted → ready. Otherwise show cached index read-only + `ReconnectBanner` (one click → `requestPermission`).
3. Indexer scans vault; parses only files whose `mtime` differs from cache.
4. Build link graph + search index. Start watcher.

**Edit (note or ticket body)**
editor change → debounce 600 ms → service serializes → `VaultFs.write` → update index entry → sidebar dot shows "Saved".

**External change** (Notepad / Obsidian)
watcher sees new mtime → re-parse → if the file is open and clean: reload silently; if dirty: banner "Changed on disk — Reload / Keep mine".

**Board drag**
drop → compute fractional `order` between neighbours → update `status` (+ `done` timestamp) → write only the moved ticket.

## 6. Milestones

Each milestone: unit tests green → `pnpm build` → copy `dist/vaultr.html` to target PC → run manual checklist.

### M0 — Project setup
- Vite + React + TS + Tailwind v4 + shadcn/ui init, dark tokens from mockup
- `vite-plugin-singlefile`, no chunks, no external requests (CI check: grep build for `http`)
- ESLint + Prettier, Vitest, Playwright
- **Done when:** `vaultr.html` opens from `file://` on target PC showing a shadcn button + dark theme.

### M1 — Vault layer
- `VaultFs` interface, FSA + memory implementations
- handle store, permission flow, `OpenVaultScreen`, `ReconnectBanner`
- create vault skeleton (`notes/ tickets/ attachments/ .vaultr/`)
- frontmatter parse/serialize, indexer with mtime cache, watcher
- **Tests:** frontmatter round-trip (unknown keys, Thai), indexer re-parse only changed, memory FS move/delete
- **Done when:** pick folder → restart Edge → reconnect in one click; editing a file in Notepad updates index within 3 s.

### M2 — App shell
- sidebar (vault switcher, nav, file tree), topbar, HashRouter routes
- save-status indicator, toasts, error boundary
- Quick switcher (Ctrl+O) over index: notes + tickets
- **Done when:** navigation + tree reflect real vault contents.

### M3 — Markdown editor (shared)
- CM6 editor: Live / Source / Reading modes
- Live Preview for Phase A syntax: headings, bold/italic/strike, inline code, code blocks, lists, task checkboxes (clickable), links, `[[wikilinks]]`, `#tags`, images, tables (render on blur), blockquote, hr
- `[[` autocomplete (notes + tickets + "Create …")
- paste/drop image → `attachments/`
- Reading view via markdown-it with same plugins
- **Tests:** extract/resolve links, attachment naming; Playwright: type markdown → preview renders
- **Done when:** 2,000-line note scrolls smoothly; paste screenshot works on target PC.

### M4 — Kanban
- Board: 3 columns, card per mockup (key, priority, deadline badge, labels, checklist progress, link/attachment counts)
- dnd-kit drag within/between columns, fractional ordering, keyboard DnD
- New ticket (inline quick add + button), `TicketDialog` (title, editor body, status, deadline picker, priority, labels, linked notes, attachments)
- Filters: search text, labels, priority, due this week, overdue
- Deadline states: overdue (red), ≤2 days (amber), normal
- **Tests:** ticket service create/move/number allocation; Playwright drag between columns
- **Done when:** 100 tickets board stays responsive; ticket file readable in Notepad.

### M5 — Notes (Obsidian Phase A)
- Notes view: tabs, breadcrumb, Properties panel (frontmatter edit)
- File tree: create / rename / move (drag) / delete (to `.trash/` folder, not hard delete)
- Rename updates backlinks (confirm dialog listing affected files)
- Right panel: Backlinks, Outgoing (incl. unresolved), Outline, Tags
- Tag pane + click tag → search
- Full-text search view (MiniSearch)
- **Done when:** vault with 1,000 notes indexes < 3 s on target PC; open in real Obsidian looks correct.

### M6 — Hardening & release
- conflict banner, write-failure retry, permission-lost handling
- empty states, loading skeletons, keyboard shortcuts sheet
- performance pass (virtualized tree/columns if needed), bundle size check
- `docs/USER_GUIDE.md` (setup on target PC, backup advice)
- **Done when:** one week of daily use on target PC without data issues.

## 7. Later phases

- **Phase B:** `![[note]]` embeds, callouts, `==highlight==`, footnotes, KaTeX, Mermaid, command palette (Ctrl+K), split panes, ticket ↔ note linking UI
- **Phase C:** graph view, block refs `^id`, daily notes, templates, unlinked mentions

## 8. Testing strategy

- **Unit (Vitest):** markdown/, services/, index/ against `MemoryFs`. Target: all pure logic covered.
- **E2E (Playwright, Chromium on Mac):** app boots with `?fs=memory` dev flag seeded with fixture vault; covers board drag, ticket edit, note create/rename, wikilink autocomplete.
- **Manual (target PC) per milestone:** checklist in `docs/MANUAL_TESTING.md` — open from `file://`, reconnect after log off, Notepad external edit, paste image, Thai text.

## 9. Risks

| Risk | Mitigation |
|---|---|
| CM6 Live Preview is the most complex part | build incrementally per syntax; Source mode always works as fallback |
| Accidental data loss from bugs | never hard-delete (`.trash/`), write whole file only after successful serialize, unit test round-trips |
| Permission prompt each session annoys | show cached data read-only immediately; reconnect is one click |
| Obsidian and app edit same file | mtime watcher + conflict banner |
| Bundle size grows (Mermaid/KaTeX in Phase B) | measure per milestone; Phase A target < 2 MB |
| Company browser policy changes | env-test pages kept in `tests/env/` to re-verify quickly |

## 10. Open decisions (defaults assumed)

- Ticket key prefix: `TD`
- Done tickets: stay in Done column; "Archive done older than 30 days" moves them to `tickets/archive/` (M6)
- Ticket dialog: modal with expand-to-full-page button
- Week starts Monday; dates shown `17 Sep 2026`
