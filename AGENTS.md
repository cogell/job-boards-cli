# Agent instructions

Start at [`docs/index.md`](docs/index.md) — it is the table of contents for everything under `docs/`, including architecture, release process, ADRs, and plan templates.

## Project essentials

- **Package manager**: `pnpm` (not `npm`)
- **Build**: `pnpm build` (tsup → `dist/search.js`)
- **Run locally**: `pnpm search -- <flags>` (via `tsx`, no build needed)
- **Entry point**: `src/search.ts`

See [`docs/architecture.md`](docs/architecture.md) for the module map before making non-trivial changes.
