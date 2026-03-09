---
name: job-boards-cli
description: >
  Search mission-driven job boards (Idealist, Tech Jobs for Good) for tech roles
  using sitemap + JSON-LD scraping with weighted relevance scoring. Use when the
  user asks about job searching, finding tech jobs at nonprofits or social impact
  organizations, scanning job boards, or wants to find remote engineering positions
  at mission-driven companies.
---

# job-boards-cli

CLI tool that searches mission-driven job boards for tech roles by scraping sitemaps and extracting JSON-LD structured data from job pages.

## Supported Boards

| Board | Key | Focus |
|-------|-----|-------|
| [Idealist.org](https://www.idealist.org) | `idealist` | Nonprofits & social impact |
| [Tech Jobs for Good](https://techjobsforgood.com) | `techjobsforgood` | Tech roles at impact orgs |

## Installation & Usage

```bash
# Run directly without installing
npx job-boards-cli

# Or install globally
npm install -g job-boards-cli
job-boards-cli
```

## CLI Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--board <name>` | `all` | Which board(s) to search. Comma-separated: `idealist`, `techjobsforgood`, or `all` |
| `--days <n>` | `7` | How far back to look (days since last updated in sitemap) |
| `--remote <bool>` | `true` | Filter to remote-only positions |
| `--limit <n>` | `50` | Max number of results |
| `--min-score <n>` | `30` | Minimum relevance score to include |
| `--verbose` | `false` | Show score breakdowns for each result |

## Example Invocations

```bash
# Search both boards, last 7 days, remote only (defaults)
npx job-boards-cli

# Search only Idealist, last 14 days
npx job-boards-cli --board idealist --days 14

# Search Tech Jobs for Good, include non-remote, lower threshold
npx job-boards-cli --board techjobsforgood --remote false --min-score 20

# Verbose output to debug scoring
npx job-boards-cli --verbose

# Combine options
npx job-boards-cli --board idealist,techjobsforgood --days 30 --limit 20 --min-score 40
```

## Scoring System

Jobs are scored on a weighted point system:

- **Title strong match (+50pts each)**: "software engineer", "engineering manager", "frontend", "backend", "devops", "data engineer", "ml engineer", etc.
- **Title moderate match (+25pts each)**: "product manager", "cto", "solutions architect", "data scientist", "security engineer", etc.
- **Description tech signals (+3pts each)**: "react", "typescript", "aws", "docker", "kubernetes", "graphql", "python", etc.
- **High signal bonus (+15pts)**: When no title match but 8+ description tech signals detected
- **Title exclusions (-1, filtered out)**: "executive director", "program manager", "fundraising", "social worker", etc.

Higher score = stronger tech role signal. Results are sorted by score descending, then by post date.

## Output Format

Each result shows:
- Score bar and points with source board
- Job title and organization
- Location and remote status
- Salary range and employment type
- Post date and expiration
- Direct URL to the listing

## How It Works

1. Fetches the XML sitemap from each board
2. Filters entries by last-modified date (--days flag)
3. Pre-filters by URL slug to skip obviously non-tech roles
4. Fetches each job page and extracts `<script type="application/ld+json">` (schema.org/JobPosting)
5. Scores each job using the weighted keyword system
6. Filters by score threshold and remote status
7. Deduplicates across boards by title+org (keeps highest score)
8. Displays sorted results

## Adding a New Board

To add a new job board, create a file in `src/boards/` with a `BoardConfig`:

```typescript
import type { BoardConfig } from "../types.js";

export const myboard: BoardConfig = {
  name: "My Board",
  sitemapUrl: "https://example.com/sitemap.xml",
  slugHints: ["engineer", "developer"], // URL patterns to pre-filter
};
```

Then register it in `src/boards/index.ts`. The board must have a sitemap with `<lastmod>` dates and job pages with JSON-LD JobPosting structured data.
