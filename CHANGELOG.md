# Changelog

## [1.2.0]

### Added
- Location filter via `location` config section with fine-grained control over which job locations to include
  - `allowRemote`: include remote jobs (detected via `remote.terms`)
  - `allowUnlisted`: include jobs with no specified location
  - `include`: list of location terms to match (case-insensitive substring)
- When `location` config is present, it replaces the `--remote` flag; when absent, `--remote` works as before

### Changed
- Progress line label renamed from "No-remote" to "Location"

## [1.1.2]

### Added
- Salary floor filtering via `minSalary` config option and `--min-salary` CLI flag
- `includeUnlistedSalary` config option and `--include-unlisted-salary` CLI flag to control whether jobs without a listed salary are included or excluded when the salary floor is active (default: `true`)
- Hourly, weekly, and monthly salaries are normalized to annual for comparison

## [1.1.1]

### Fixed
- Pinned `fast-xml-parser` to 5.4.2 to fix install error

## [1.1.0]

### Added
- Configurable YAML config for scoring keywords, weights, and board definitions
- Config file discovery (local directory and `~/.config/job-boards-cli/`)
- `extends: defaults` option to merge user config with built-in defaults
- `--config`, `--init`, `--show-config`, `--show-defaults` CLI flags
- Board overrides and custom board definitions via config

## [1.0.0]

### Added
- Multi-board job search via sitemap + JSON-LD scraping
- Built-in boards: Idealist, Tech Jobs for Good
- Keyword-based scoring with title strong/moderate and description signal weights
- Title exclusion list for non-tech roles
- Remote position detection
- Concurrent fetching with rate limiting
- Deduplication across boards
- `--board`, `--days`, `--remote`, `--limit`, `--min-score`, `--verbose` CLI flags
