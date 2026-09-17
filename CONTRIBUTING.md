# Contributing to Vaultr

Thanks for your interest! Bug reports, ideas and pull requests are all welcome.

## Ground rules

Vaultr has a few hard constraints — please keep them intact:

1. **One self-contained file.** `pnpm build` must produce a single `dist/vaultr.html` with no external requests (no CDNs, fonts or analytics). `scripts/postbuild.mjs` enforces this.
2. **The vault folder is the source of truth.** Everything the user writes is a plain file (Markdown, attachments). IndexedDB is only a cache; losing it must never lose data.
3. **Never hard-delete user data.** Deletes go to `.trash/`.
4. **Obsidian compatibility.** Wikilinks, frontmatter and embeds should keep working if the vault is opened in Obsidian.

## Setup

Requirements: Node.js ≥ 20.19, pnpm 10, and Microsoft Edge (for E2E tests and screenshots).

```bash
pnpm install
pnpm dev            # http://localhost:5173
```

Open `http://localhost:5173/?fs=demo` for a rich in-memory demo vault, or `?fs=memory` for the small fixture used by tests. Neither touches your disk.

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm test           # Vitest unit tests
pnpm e2e            # Playwright E2E in Microsoft Edge
pnpm build          # dist/vaultr.html
pnpm screenshots    # regenerate docs/images from the demo vault
```

Please add or update tests with your change: unit tests next to the code (`*.test.ts`) for logic, `tests/e2e/*.spec.ts` for user flows.

Before a release, run [`docs/MANUAL_TESTING.md`](docs/MANUAL_TESTING.md) on a real Windows machine — enterprise browser policies can change how the File System Access API behaves.

## Project layout

See the *Architecture* section of the [README](README.md#architecture).

## Pull requests

- Keep PRs focused; describe the user-facing change and how you tested it.
- UI changes: include a before/after screenshot.
- CI (typecheck, lint, unit, build, E2E) must pass.
