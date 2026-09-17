# Manual test checklist

Browser APIs Vaultr depends on (File System Access, IndexedDB, clipboard) behave differently under enterprise
policies, so run this checklist on the real target machine before a release — ideally a locked-down Windows PC
with Microsoft Edge. Open `vaultr.html` by double-clicking it (`file://`).

Use a **test vault** (e.g. `Documents\Vaultr-test`), not real notes. Tick each box; note anything odd next to it.

## A. Vault & storage

0. [ ] Browser tab shows the **Vaultr** title and the blue→violet "V" icon (also when pinned)

1. [ ] First open shows **Open a vault** → Choose folder → pick the empty test folder
2. [ ] Explorer: folder now has `notes`, `tickets`, `attachments`, `.vaultr`
3. [ ] Close every Edge window, reopen `vaultr.html` → amber **Vault is locked** banner with data still visible → **Reconnect vault** → Allow → banner gone
4. [ ] Log off / log on → repeat step 3
5. [ ] Vault menu (top-left) → **Close vault** → back to Open a vault; choosing the same folder shows the same data

## B. Board

6. [ ] **New ticket** → title in Thai + English, status, priority, deadline → Create → dialog opens on the new ticket (key `TD-1`)
7. [ ] In the dialog: change Status / Priority / Deadline / Labels → card on the board updates
7a. [ ] Panel icon in the ticket header hides/shows the Details panel; when hidden, a one-line summary (status, priority, deadline, labels) shows under the title; the choice is remembered for the next ticket
8. [ ] Type a description with a checklist `- [ ] item`; click the checkbox → it toggles
9. [ ] **Paste a screenshot** (Win+Shift+S, then Ctrl+V) into the description → image shows; file appears in `attachments\`
10. [ ] Close dialog → drag the card to another column and to a different position → reload page (F5) → position kept
11. [ ] Open `tickets\TD-1.md` in Notepad → readable frontmatter (`status:`, `priority:`, `deadline:`) and your description
12. [ ] Filters: text box, Labels, Priority, **Due this week**, **Overdue**, Clear filters
13. [ ] Ticket menu `…` → Delete → confirm → file moved to `.trash\tickets\`
14. [ ] Keyboard: `Ctrl+Alt+T` opens New ticket

## C. Notes

15. [ ] Sidebar **New note** icon → note opens with title *Untitled* → rename via the big title → file renamed in Explorer
16. [ ] Write markdown: `# heading`, `**bold**`, `- list`, `- [ ] task`, a table, a code block → Live mode renders them; the line with the cursor shows raw syntax
17. [ ] Type `[[` → list of notes/tickets appears → Enter inserts link → click the link opens that note (Ctrl+click opens a new tab)
18. [ ] Link to a ticket `[[TD-1]]` → click opens the ticket dialog
19. [ ] Click an unresolved link `[[Brand new note]]` → note is created
20. [ ] Right panel: **Links** shows backlinks/outgoing; **Outline** jumps to headings; **Tags** lists `#tags`
21. [ ] Properties: add a property, edit tags, remove a property → check the frontmatter in Notepad
22. [ ] Source and Reading modes switch correctly
22a. [ ] Source mode looks like VS Code: file name header, line numbers, highlighted current line, coloured markdown, long lines wrap onto the next row (line number stays on the first row); hover the gutter to fold a heading section
22b. [ ] **Copy** in the Source header → "Copied" → paste into Notepad/Teams gives the raw markdown
23. [ ] Rename a note that other notes link to → toast "Updated links in N files" → links in other files point to the new name
24. [ ] File tree: right-click → New folder, Rename, Move to trash; drag a note onto a folder
24a. [ ] Open a note inside a folder → sidebar **New note** icon (hover shows "New note in <folder>") creates the note in that same folder, not at the top
24b. [ ] Right-click a note or folder → **Move to…** → type part of a folder name → Enter → file moves; links to it still work (also in the note's `…` menu)
25. [ ] Paste an image into a note → shows inline
25a. [ ] On an empty line type `/` → block menu (Text, Heading 1–3, lists, To-do, Quote, Callout, Code block, Table, Divider, Link, Image, Date, Highlight); type `/code` + Enter → code block with cursor inside
25b. [ ] Type `/quote` → write text → Enter twice → leaves the quote; `/callout` renders as a coloured box
25d. [ ] Type `/link` → hint "Paste a link, then press Space" → Ctrl+V a URL (e.g. a Jira or Confluence page) → Space → becomes a chip; click opens a new Edge tab; a pasted bare `https://…` also becomes a chip; click at the end of the line to edit the raw `[label](url)`
25c. [ ] `/image` opens the file picker → chosen file saved to `attachments\` and shown

## D. Search & navigation

26. [ ] `Ctrl+O` opens Quick open (Edge must **not** show its Open File dialog; if it does, use `Ctrl+K`)
27. [ ] `Ctrl+Shift+F` → search Thai words that are part of a longer sentence → results with highlighted snippet
28. [ ] Search `#tag` filters by tag
29. [ ] `Ctrl+/` shows the shortcuts list; `Ctrl+B` hides/shows the sidebar

## E. Outside changes & safety

30. [ ] With a note open (not typing), edit the same file in Notepad and save → app shows the new text within ~3 s
31. [ ] Start typing in the app, then within 1 s save a different change in Notepad → amber **changed on disk** banner → **Keep my version** / **Reload from disk** both behave as named
32. [ ] Create a `.md` file in `notes\` with Explorer → appears in the tree within ~3 s
33. [ ] Board **Done** column `…` → Archive done older than 30 days (only moves old done tickets into `tickets\archive\`)

## F. Optional: Obsidian

34. [ ] If Obsidian is available elsewhere, open the vault folder there → notes, links and images look right
