# Cutting a release

How to publish a new version of `job-boards-cli` to npm.

## Prerequisites

- Clean working tree on `main` with your changes committed
- Logged in to npm as the package owner: `npm whoami` (use `npm login` if not)
- `pnpm` installed (this project uses pnpm — `npm` is aliased to `pnpm` locally)

## Versioning

Follow semver against the published surface (CLI flags, config schema, built-in board keys):

| Change | Bump |
|--------|------|
| Bug fix, dependency pin, internal refactor | patch (`1.2.0` → `1.2.1`) |
| New flag, new board, new config option (backwards-compatible) | minor (`1.2.0` → `1.3.0`) |
| Removed/renamed flag, breaking config change | major (`1.2.0` → `2.0.0`) |

Check current published versions: `npm view job-boards-cli versions`.

## Steps

### 1. Update `CHANGELOG.md`

Add a new section at the top following the existing format:

```markdown
## [X.Y.Z]

### Added
- ...

### Changed
- ...

### Fixed
- ...
```

Only include the subsections that apply.

### 2. Bump `package.json` version

Edit `version` in `package.json` to match the changelog entry. Do not use `npm version` — it creates a tag before the build/publish is verified.

### 3. Build

```bash
pnpm build
```

This runs `tsup` and produces `dist/search.js` (the single bundled CLI entry with a `#!/usr/bin/env node` banner). The `files` field in `package.json` ships `dist/` and `skills/` only.

### 4. Smoke test the built artifact

```bash
node dist/search.js --show-defaults
node dist/search.js --help 2>/dev/null || node dist/search.js --board idealist --days 1 --limit 1
```

Confirm it runs without crashing and the shebang is intact.

### 5. Commit

```bash
git add CHANGELOG.md package.json
git commit -m "Release vX.Y.Z"
```

Do not commit `dist/` — it is gitignored and rebuilt on publish.

### 6. Tag

```bash
git tag vX.Y.Z
```

### 7. Publish to npm

```bash
pnpm publish --access public
```

`pnpm publish` runs `pnpm build` via its own prepublish lifecycle, so `dist/` will be fresh in the tarball. Verify the published contents first with a dry run if unsure:

```bash
pnpm publish --dry-run
```

### 8. Push commit and tag

```bash
git push origin main
git push origin vX.Y.Z
```

### 9. Verify

```bash
npm view job-boards-cli version
npx job-boards-cli@X.Y.Z --show-defaults
```

The `npx` call fetches the freshly published tarball and confirms the bin entry works end-to-end.

## If something goes wrong

- **Published a broken version**: `npm deprecate job-boards-cli@X.Y.Z "broken, use X.Y.Z+1"`, then cut a patch release. Do not `npm unpublish` — it blocks reuse of the version number for 24 hours and breaks anyone who already installed it.
- **Tagged but didn't publish**: `git tag -d vX.Y.Z` locally. If already pushed, `git push origin :refs/tags/vX.Y.Z`.
- **Forgot to bump version**: npm will reject the publish. Bump, rebuild, retry.
