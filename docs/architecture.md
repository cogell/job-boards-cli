# Architecture

## Pipeline overview

The CLI processes jobs through a linear pipeline. Each board runs through the full pipeline independently, then results are merged and deduplicated.

```
Sitemap XML ──► Date filter ──► Slug pre-filter ──► Fetch HTML ──► Extract JSON-LD
                                                                         │
                                                                         ▼
                                                              Score (keyword matching)
                                                                         │
                                                                         ▼
                                                              Filter (score, salary, location)
                                                                         │
                                                                         ▼
                                                              Deduplicate (title+org)
                                                                         │
                                                                         ▼
                                                              Sort & display
```

## Modules

| Module | File | Responsibility |
|--------|------|----------------|
| **CLI entry** | `src/search.ts` | Parse args, orchestrate pipeline, deduplicate across boards |
| **Config** | `src/config.ts` | YAML config discovery, loading, merging with defaults |
| **Defaults** | `src/defaults.ts` | Built-in keyword lists, weights, board definitions |
| **Scraper** | `src/scraper.ts` | Sitemap fetching, HTML fetching, JSON-LD extraction |
| **Scoring** | `src/scoring.ts` | Keyword matching, score calculation, location filtering |
| **Display** | `src/display.ts` | Terminal output formatting |
| **Types** | `src/types.ts` | Shared TypeScript interfaces |
| **Boards** | `src/boards/` | Per-board config (sitemap URL, slug hints) |

## Key design decisions

### Sitemap-first discovery

Jobs are discovered via each board's XML sitemap rather than scraping listing pages or using APIs. This is reliable because sitemaps are stable, machine-readable, and include `lastmod` dates for time-based filtering.

### JSON-LD for structured data

Job details come from `<script type="application/ld+json">` tags containing schema.org `JobPosting` data. This avoids fragile HTML scraping — most job boards embed structured data for SEO.

### Two-phase filtering

1. **Slug pre-filter**: Before fetching any HTML, URLs are filtered by configurable slug hints (e.g., `/engineer/`, `/developer/`). This avoids fetching non-job pages.
2. **Post-fetch scoring**: After extraction, jobs are scored and filtered by keywords, salary, and location.

### Concurrent fetching with rate limiting

Job pages are fetched in batches of 5 with a 250ms delay between batches to avoid overwhelming target servers.

### Config merging with `extends: defaults`

When a user config specifies `extends: defaults`, array fields (keyword lists) are unioned with built-in defaults. Without it, user values replace defaults entirely. Scalar weights always override.
