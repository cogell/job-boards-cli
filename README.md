# job-boards-cli

CLI tool that searches job boards by scraping sitemaps and scoring jobs via configurable keyword matching. Built for social-impact and nonprofit tech roles.

## Quick start

```bash
# Search with defaults (all boards, 7 days, remote only)
npx job-boards-cli

# Generate a config file to customize scoring/keywords
npx job-boards-cli --init

# Search specific board, wider time window
npx job-boards-cli --board idealist --days 14
```

## Built-in boards

| Board | Key | Focus |
|-------|-----|-------|
| [Idealist.org](https://www.idealist.org) | `idealist` | Nonprofits & social impact |
| [Tech Jobs for Good](https://techjobsforgood.com) | `techjobsforgood` | Tech roles at impact orgs |

## CLI flags

| Flag | Default | Description |
|------|---------|-------------|
| `--board <name>` | `all` | Board(s) to search (comma-separated or `all`) |
| `--days <n>` | `7` | Days back to look in sitemap |
| `--remote <bool>` | `true` | Remote-only filter (ignored when `location` config is set) |
| `--limit <n>` | `50` | Max results |
| `--min-score <n>` | `30` | Minimum relevance score |
| `--min-salary <n>` | `0` | Minimum annual salary floor (0 = disabled) |
| `--include-unlisted-salary <bool>` | `true` | Include jobs with no listed salary when salary floor is active |
| `--verbose` | `false` | Show score breakdowns |
| `--config <path>` | *(auto)* | Path to YAML config file |
| `--init` | — | Generate starter config |
| `--show-config` | — | Print resolved config |
| `--show-defaults` | — | Print built-in defaults |

## Configuration

All keywords, weights, exclusions, and board definitions are customizable via YAML config. Run `--init` to generate a starter file, then edit it.

Config is discovered in order: `--config` flag, `./job-boards-cli.yml`, `~/.config/job-boards-cli/config.yml`, built-in defaults.

## Documentation

- [Architecture](docs/architecture.md) — how the scraping and scoring pipeline works
- [CHANGELOG](CHANGELOG.md) — version history
- [Skill reference](skills/job-boards-cli/REFERENCE.md) — full config format, scoring system, and board definitions
