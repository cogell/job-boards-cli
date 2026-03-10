# job-boards-cli Reference

## Built-in boards

| Board | Key | Focus |
|-------|-----|-------|
| [Idealist.org](https://www.idealist.org) | `idealist` | Nonprofits & social impact |
| [Tech Jobs for Good](https://techjobsforgood.com) | `techjobsforgood` | Tech roles at impact orgs |

## Config file

### Discovery order

1. `--config <path>` (explicit flag)
2. `./job-boards-cli.yml` or `./.job-boards-cli.yml` in the current directory
3. `~/.config/job-boards-cli/config.yml` (user global)
4. Built-in defaults (no file needed)

### Format

```yaml
# Merge your values with built-in defaults (arrays are unioned).
# Omit this line to replace defaults entirely for each section you provide.
extends: defaults

scoring:
  # Point values for each match type
  weights:
    titleStrong: 50
    titleModerate: 25
    descriptionSignal: 3
    highSignalBonus: 15
    highSignalThreshold: 8
    highSignalScoreCeiling: 25

  # Job titles containing these get +titleStrong points
  titleStrong:
    - "software engineer"
    - "frontend"

  # Job titles containing these get +titleModerate points
  titleModerate:
    - "product manager"
    - "data scientist"

  # Keywords in job descriptions that signal a relevant role
  descriptionSignals:
    - "react"
    - "typescript"

  # Job titles containing these are excluded entirely
  exclusions:
    - "executive director"
    - "social worker"

# Override slug hints for built-in boards or define new boards
boards:
  idealist:
    slugHints:
      - "engineer"
      - "my-custom-slug"

  # Add a new board (requires name, sitemapUrl, slugHints)
  myboard:
    name: "My Board"
    sitemapUrl: "https://example.com/sitemap.xml"
    slugHints:
      - "/jobs/"

# Minimum annual salary floor (0 or omit to disable).
# Hourly/weekly/monthly salaries are normalized to annual.
minSalary: 100000

# Include jobs with no listed salary when minSalary is active? (default: true)
includeUnlistedSalary: true

# Terms used to detect remote positions
remote:
  terms:
    - "remote"
    - "telecommute"
```

### `extends: defaults` vs replace mode

| Behavior | `extends: defaults` | No `extends` |
|----------|:-------------------:|:------------:|
| User provides `titleStrong` | Merged with built-in list | Replaces built-in list |
| User omits `titleStrong` | Built-in list used | Built-in list used |
| `weights` | User values override individual weights | Same |

Use `extends: defaults` to **add** keywords to built-in lists. Omit it to **replace** them entirely.

## Scoring system

Jobs are scored on a configurable weighted point system:

- **Title strong match** (default +50pts each): e.g., "software engineer", "frontend", "devops"
- **Title moderate match** (default +25pts each): e.g., "product manager", "cto", "data scientist"
- **Description signals** (default +3pts each): e.g., "react", "typescript", "aws", "kubernetes"
- **High signal bonus** (default +15pts): When score is below ceiling but description has many signals
- **Title exclusions** (filtered out): e.g., "executive director", "social worker"

Run `--show-defaults` to see the full built-in keyword lists.

## How it works

1. Fetches the XML sitemap from each board
2. Filters entries by last-modified date (`--days` flag)
3. Pre-filters by URL slug hints (configurable per board)
4. Fetches each job page and extracts `<script type="application/ld+json">` (schema.org/JobPosting)
5. Scores each job using the configurable keyword system
6. Filters by score threshold, salary floor, and remote status
7. Deduplicates across boards by title+org (keeps highest score)
8. Displays sorted results

## Output format

Each result shows:
- Score bar and points with source board
- Job title and organization
- Location and remote status
- Salary range and employment type
- Post date and expiration
- Direct URL to the listing
