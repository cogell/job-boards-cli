---
name: job-boards-cli
description: >
  Search job boards for roles using sitemap + JSON-LD scraping with configurable
  keyword scoring, weights, and exclusions. Use when the user asks about job
  searching, scanning job boards, finding open positions, or customizing job
  search filters and scoring criteria.
---

# job-boards-cli

CLI tool that searches job boards by scraping sitemaps and scoring jobs via configurable keyword matching. All keywords, weights, and exclusions are customizable via YAML config.

## Quick start

```bash
# Search with defaults (all boards, 7 days, remote only)
npx job-boards-cli

# Generate a config file to customize scoring/keywords
npx job-boards-cli --init

# Search with a custom config
npx job-boards-cli --config ./my-config.yml
```

## Workflows

### Basic search

```bash
npx job-boards-cli --board idealist --days 14
npx job-boards-cli --remote false --min-score 20
npx job-boards-cli --verbose  # show score breakdowns
```

### Customizing scoring and keywords

1. Run `npx job-boards-cli --init` to generate a starter `job-boards-cli.yml`
2. Edit the config to add/replace keywords, adjust weights, or define new boards
3. Use `extends: defaults` to merge with built-ins, or omit to replace entirely
4. Run `npx job-boards-cli --show-config` to verify the resolved config

### CLI flags

| Flag | Default | Description |
|------|---------|-------------|
| `--board <name>` | `all` | Board(s) to search (comma-separated or `all`) |
| `--days <n>` | `7` | Days back to look in sitemap |
| `--remote <bool>` | `true` | Remote-only filter |
| `--limit <n>` | `50` | Max results |
| `--min-score <n>` | `30` | Minimum relevance score |
| `--min-salary <n>` | `0` | Minimum annual salary floor (0 = disabled) |
| `--include-unlisted-salary <bool>` | `true` | Include jobs with no listed salary when salary floor is active |
| `--verbose` | `false` | Show score breakdowns |
| `--config <path>` | *(auto)* | Path to YAML config file |
| `--init` | — | Generate starter config |
| `--show-config` | — | Print resolved config |
| `--show-defaults` | — | Print built-in defaults |

## Advanced features

See [REFERENCE.md](REFERENCE.md) for config file format, scoring system details, board definitions, and `extends` merge behavior.
