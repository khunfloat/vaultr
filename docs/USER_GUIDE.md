# Vaultr — User guide

Vaultr is a single file, `vaultr.html`. It needs no installation and no internet. Everything you write is saved as plain Markdown files in a folder you choose (the *vault*).

## Setup

1. Put `vaultr.html` somewhere permanent, e.g. `Documents\Vaultr\vaultr.html` (not Downloads).
2. Create an empty folder for your data, e.g. `Documents\VaultrData`.
3. Double-click `vaultr.html` — it opens in Edge. Click **Choose folder…** and pick the vault folder. Allow editing when Edge asks.
4. Optional: pin the tab or bookmark it.

Each time you reopen Edge, the app shows your data read-only with a **Reconnect vault** banner. One click restores editing — this is Edge's security rule for local folders.

## What's in the vault

```
VaultrData\
  notes\          your notes (any folders you like)
  tickets\        one file per ticket, e.g. TD-12.md
    archive\      old done tickets
  attachments\    pasted screenshots and files
  .vaultr\        app settings (ticket numbering)
  .trash\         deleted items — restore by moving them back in Explorer
```

Everything is ordinary text, so you can read or fix files in Notepad or open the folder in Obsidian.

## Board

- **New ticket** (or `Ctrl+Alt+T`), or `+` on a column.
- Drag cards between columns and up/down to order them.
- Click a card to open it: edit title, status, deadline, priority, labels, and a Markdown description. Paste screenshots or drop files straight into the description.
- Deadline colours: red = overdue, amber = today / within 2 days.
- Done column menu → **Archive done older than 30 days** keeps the board tidy.

## Notes

- Sidebar icons create notes/folders; right-click for rename, move to trash. Drag notes onto folders to move them.
- **Live** shows formatting as you type; **Source** shows raw Markdown; **Reading** is view-only.
- Type `/` on a line for a block menu like Notion: headings, lists, to-do, quote, callout, code block, table, divider, link, image/file, today's date, highlight. Keep typing to filter (`/code`, `/h2`, `/todo`, Thai keywords work too).
- Web links: type `/link`, paste the URL (Ctrl+V), press Space → chip. Pasted `https://…` and `[title](https://…)` also show as chips; click to open in a new tab. Put the cursor on the line to edit the raw link.
- `[[` links to any note or ticket. Clicking a link to a note that doesn't exist creates it.
- Renaming or moving a note updates links to it in other files.
- Right panel: backlinks, outline, and all tags.
- Properties at the top edit the note's frontmatter.

## Search & shortcuts

| Keys | Action |
|---|---|
| `Ctrl+O` / `Ctrl+K` | Quick open |
| `Ctrl+Shift+F` | Search everything (`#tag` to filter) |
| `Ctrl+Alt+N` | New note |
| `Ctrl+Alt+T` | New ticket |
| `Ctrl+B` | Toggle sidebar |
| `Ctrl+/` | Shortcuts list |
| `Ctrl+F` | Find inside the open note |

## Safety & backup

- The app never hard-deletes: deletes go to `.trash\`.
- If a file changes on disk while you're typing (e.g. edited in Notepad), you choose **Reload from disk** or **Keep my version**.
- The vault folder *is* your data. Back it up like any folder — copy it, or keep it in a synced company folder such as OneDrive.
- Use the same browser (Edge) each time; the app's cache and folder permission live in that browser profile. Your files are unaffected if the cache is cleared.

## Troubleshooting

| Problem | Fix |
|---|---|
| "This browser can't access folders" | Open `vaultr.html` in Edge or Chrome |
| Banner "Vault is locked" | Click **Reconnect vault** → Allow |
| "Not saved" in the header | Click **Retry**; if it persists, Reconnect the vault |
| Ticket shows "invalid frontmatter" | Open it in Source mode (or Notepad) and fix the YAML between the `---` lines |
| Something looks stale | Vault menu → **Rescan folder** |
