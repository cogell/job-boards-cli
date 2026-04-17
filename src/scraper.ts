import { XMLParser } from "fast-xml-parser";
import type { BoardConfig, SitemapBoardConfig, GreenhouseBoardConfig, RssBoardConfig, SitemapEntry, JobFields, ScoredJob, ResolvedConfig } from "./types.js";
import { scoreJob, passesLocationFilter } from "./scoring.js";

const CONCURRENCY = 5;
const REQUEST_DELAY_MS = 250;

// --- Fetch helpers ---

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} fetching ${url}`);
  return res.text();
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// --- Sitemap parsing ---

export async function fetchSitemap(board: SitemapBoardConfig, daysBack: number): Promise<SitemapEntry[]> {
  console.log(`  [${board.name}] Fetching sitemap...`);
  const xml = await fetchText(board.sitemapUrl);
  const parser = new XMLParser();
  const parsed = parser.parse(xml);
  const urls: Array<{ loc: string; lastmod?: string }> = parsed.urlset.url;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);

  const entries: SitemapEntry[] = [];
  for (const u of urls) {
    if (!u.lastmod) continue;
    const mod = new Date(u.lastmod);
    if (mod >= cutoff) {
      entries.push({ url: u.loc, lastmod: u.lastmod });
    }
  }

  console.log(`  [${board.name}] ${entries.length} jobs updated in last ${daysBack} days (of ${urls.length} total)`);
  return entries;
}

// --- JSON-LD extraction ---

function extractJsonLd(html: string): any | null {
  const regex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      if (data["@type"] === "JobPosting") return data;
      if (Array.isArray(data)) {
        const jp = data.find((d: any) => d["@type"] === "JobPosting");
        if (jp) return jp;
      }
    } catch {}
  }
  return null;
}

function normalizeToAnnual(value: number, unitText?: string): number {
  const unit = (unitText || "year").toLowerCase();
  if (unit === "hour") return value * 2080;
  if (unit === "month") return value * 12;
  if (unit === "week") return value * 52;
  return value; // assume annual
}

function parseJobFields(jsonLd: any, pageUrl: string): JobFields {
  const salary = jsonLd.baseSalary;
  let salaryStr = "Not listed";
  let salaryMin: number | null = null;
  if (salary?.value) {
    const v = salary.value;
    if (v.minValue && v.maxValue) {
      salaryStr = `$${v.minValue}-$${v.maxValue}/${v.unitText?.toLowerCase() || "year"}`;
      salaryMin = normalizeToAnnual(Number(v.minValue), v.unitText);
    } else if (v.value) {
      salaryStr = `$${v.value}/${v.unitText?.toLowerCase() || "year"}`;
      salaryMin = normalizeToAnnual(Number(v.value), v.unitText);
    }
  }

  const loc = jsonLd.jobLocation?.address;
  let locationStr = "Not specified";
  if (loc) {
    const parts = [loc.addressLocality, loc.addressRegion, loc.addressCountry].filter(Boolean);
    locationStr = parts.join(", ");
  }

  let locationType = jsonLd.jobLocationType || "";
  if (jsonLd.applicantLocationRequirements) {
    const reqs = Array.isArray(jsonLd.applicantLocationRequirements)
      ? jsonLd.applicantLocationRequirements
      : [jsonLd.applicantLocationRequirements];
    const names = reqs.map((r: any) => r.name).filter(Boolean);
    if (names.length) locationType += ` (${names.join(", ")})`;
  }

  const plainDesc = (jsonLd.description || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

  return {
    title: jsonLd.title || "Untitled",
    org: jsonLd.hiringOrganization?.name || "Unknown",
    location: locationStr,
    locationType: locationType || "On-site",
    salary: salaryStr,
    salaryMin,
    employmentType: jsonLd.employmentType || "Not specified",
    datePosted: jsonLd.datePosted?.split("T")[0] || "Unknown",
    validThrough: jsonLd.validThrough?.split("T")[0] || "Unknown",
    url: pageUrl,
    description: plainDesc,
  };
}

// --- Batch fetch with concurrency ---

export async function fetchJobDetails(
  board: SitemapBoardConfig,
  entries: SitemapEntry[],
  remoteOnly: boolean,
  limit: number,
  minScore: number,
  minSalary: number,
  includeUnlistedSalary: boolean,
  verbose: boolean,
  config: ResolvedConfig,
): Promise<ScoredJob[]> {
  const results: ScoredJob[] = [];
  let fetched = 0;
  let excluded = 0;
  let belowThreshold = 0;
  let belowSalary = 0;
  let skippedRemote = 0;
  let errors = 0;

  const preFiltered = entries.filter((e) => {
    const slug = e.url.toLowerCase();
    return board.slugHints.some((hint) => slug.includes(hint));
  });

  console.log(`  [${board.name}] Pre-filtered to ${preFiltered.length} candidates by URL slug`);
  console.log(`  [${board.name}] Fetching details (concurrency: ${CONCURRENCY})...\n`);

  for (let i = 0; i < preFiltered.length && results.length < limit; i += CONCURRENCY) {
    const batch = preFiltered.slice(i, i + CONCURRENCY);

    const promises = batch.map(async (entry) => {
      try {
        const html = await fetchText(entry.url);
        fetched++;
        const jsonLd = extractJsonLd(html);
        if (!jsonLd) return null;

        const fields = parseJobFields(jsonLd, entry.url);
        const { score, breakdown, hybridWarning } = scoreJob(fields, config);

        if (score < 0) {
          excluded++;
          if (verbose) console.log(`\n  [${board.name}][EXCL] ${fields.title} — ${breakdown}`);
          return null;
        }

        if (score < minScore) {
          belowThreshold++;
          if (verbose) console.log(`\n  [${board.name}][LOW ${score}] ${fields.title} — ${breakdown}`);
          return null;
        }

        if (minSalary > 0 && (fields.salaryMin !== null ? fields.salaryMin < minSalary : !includeUnlistedSalary)) {
          belowSalary++;
          if (verbose) console.log(`\n  [${board.name}][SAL] ${fields.title} — ${fields.salary}`);
          return null;
        }

        if (hybridWarning && config.hybrid.action === "exclude") {
          skippedRemote++;
          if (verbose) console.log(`\n  [${board.name}][HYB] ${fields.title} — ${hybridWarning}`);
          return null;
        }

        if (!passesLocationFilter(fields, remoteOnly, config)) {
          skippedRemote++;
          return null;
        }

        return { ...fields, source: board.name, score, scoreBreakdown: breakdown, hybridWarning } as ScoredJob;
      } catch {
        errors++;
        return null;
      }
    });

    const jobs = await Promise.all(promises);
    for (const job of jobs) {
      if (job && results.length < limit) results.push(job);
    }

    const pct = Math.round((fetched / preFiltered.length) * 100);
    process.stdout.write(
      `\r  [${board.name}] Fetched: ${fetched}/${preFiltered.length} (${pct}%) | Matches: ${results.length} | Excluded: ${excluded} | Low: ${belowThreshold}${minSalary > 0 ? ` | Salary: ${belowSalary}` : ""} | Location: ${skippedRemote} | Err: ${errors}`,
    );

    if (i + CONCURRENCY < preFiltered.length) await sleep(REQUEST_DELAY_MS);
  }

  console.log("\n");
  return results;
}

// --- Greenhouse API ---

function parseGreenhouseJob(job: any, boardName: string): JobFields {
  const locationName = job.location?.name || "";
  const isRemote = locationName.toLowerCase().includes("remote");

  const plainDesc = (job.content || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

  return {
    title: job.title || "Untitled",
    org: boardName,
    location: locationName || "Not specified",
    locationType: isRemote ? "TELECOMMUTE" : "On-site",
    salary: "Not listed",
    salaryMin: null,
    employmentType: "Not specified",
    datePosted: job.updated_at ? job.updated_at.split("T")[0] : "Unknown",
    validThrough: "Unknown",
    url: job.absolute_url || "",
    description: plainDesc,
  };
}

async function fetchGreenhouseJobs(
  board: GreenhouseBoardConfig,
  daysBack: number,
  remoteOnly: boolean,
  limit: number,
  minScore: number,
  minSalary: number,
  includeUnlistedSalary: boolean,
  verbose: boolean,
  config: ResolvedConfig,
): Promise<ScoredJob[]> {
  const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${board.boardId}/jobs?content=true`;
  console.log(`  [${board.name}] Fetching Greenhouse API...`);

  const res = await fetch(apiUrl);
  if (!res.ok) throw new Error(`${res.status} fetching ${apiUrl}`);
  const data = await res.json();
  const allJobs: any[] = data.jobs || [];

  // Date filter
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);

  const recent = allJobs.filter((j) => {
    if (!j.updated_at) return false;
    return new Date(j.updated_at) >= cutoff;
  });

  console.log(`  [${board.name}] ${recent.length} jobs updated in last ${daysBack} days (of ${allJobs.length} total)`);

  const results: ScoredJob[] = [];
  let excluded = 0;
  let belowThreshold = 0;
  let belowSalary = 0;
  let skippedLocation = 0;

  for (const job of recent) {
    if (results.length >= limit) break;

    const fields = parseGreenhouseJob(job, board.name);
    const { score, breakdown, hybridWarning } = scoreJob(fields, config);

    if (score < 0) {
      excluded++;
      if (verbose) console.log(`\n  [${board.name}][EXCL] ${fields.title} — ${breakdown}`);
      continue;
    }

    if (score < minScore) {
      belowThreshold++;
      if (verbose) console.log(`\n  [${board.name}][LOW ${score}] ${fields.title} — ${breakdown}`);
      continue;
    }

    if (minSalary > 0 && !includeUnlistedSalary) {
      belowSalary++;
      if (verbose) console.log(`\n  [${board.name}][SAL] ${fields.title} — ${fields.salary}`);
      continue;
    }

    if (hybridWarning && config.hybrid.action === "exclude") {
      skippedLocation++;
      if (verbose) console.log(`\n  [${board.name}][HYB] ${fields.title} — ${hybridWarning}`);
      continue;
    }

    if (!passesLocationFilter(fields, remoteOnly, config)) {
      skippedLocation++;
      continue;
    }

    results.push({ ...fields, source: board.name, score, scoreBreakdown: breakdown, hybridWarning });
  }

  console.log(`  [${board.name}] Matches: ${results.length} | Excluded: ${excluded} | Low: ${belowThreshold}${minSalary > 0 ? ` | Salary: ${belowSalary}` : ""} | Location: ${skippedLocation}\n`);
  return results;
}

// --- RSS feed parsing ---

function parseRssItem(item: any, boardName: string): JobFields {
  const rawTitle: string = item.title || "Untitled";
  const colonIdx = rawTitle.indexOf(": ");
  const org = colonIdx >= 0 ? rawTitle.slice(0, colonIdx) : "Unknown";
  const title = colonIdx >= 0 ? rawTitle.slice(colonIdx + 2) : rawTitle;

  const plainDesc = (item.description || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

  let datePosted = "Unknown";
  if (item.pubDate) {
    const d = new Date(item.pubDate);
    if (!isNaN(d.getTime())) {
      datePosted = d.toISOString().split("T")[0];
    }
  }

  return {
    title,
    org,
    location: item.region || "Not specified",
    locationType: "TELECOMMUTE",
    salary: "Not listed",
    salaryMin: null,
    employmentType: "Not specified",
    datePosted,
    validThrough: "Unknown",
    url: item.link || item.guid || "",
    description: plainDesc,
  };
}

async function fetchRssJobs(
  board: RssBoardConfig,
  daysBack: number,
  remoteOnly: boolean,
  limit: number,
  minScore: number,
  minSalary: number,
  includeUnlistedSalary: boolean,
  verbose: boolean,
  config: ResolvedConfig,
): Promise<ScoredJob[]> {
  console.log(`  [${board.name}] Fetching ${board.feedUrls.length} RSS feeds...`);

  const parser = new XMLParser();
  const feedResults = await Promise.all(
    board.feedUrls.map(async (url) => {
      try {
        const xml = await fetchText(url);
        const parsed = parser.parse(xml);
        const items = parsed?.rss?.channel?.item;
        if (!items) return [];
        return Array.isArray(items) ? items : [items];
      } catch (err) {
        console.error(`  [${board.name}] Error fetching ${url}: ${err}`);
        return [];
      }
    }),
  );

  // Flatten and deduplicate by guid
  const seen = new Set<string>();
  const allItems: any[] = [];
  for (const items of feedResults) {
    for (const item of items) {
      const id = item.guid || item.link || item.title;
      if (!seen.has(id)) {
        seen.add(id);
        allItems.push(item);
      }
    }
  }

  // Date filter
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);

  const recent = allItems.filter((item) => {
    if (!item.pubDate) return false;
    return new Date(item.pubDate) >= cutoff;
  });

  console.log(`  [${board.name}] ${recent.length} jobs in last ${daysBack} days (of ${allItems.length} unique across feeds)`);

  const results: ScoredJob[] = [];
  let excluded = 0;
  let belowThreshold = 0;
  let belowSalary = 0;
  let skippedLocation = 0;

  for (const item of recent) {
    if (results.length >= limit) break;

    const fields = parseRssItem(item, board.name);
    const { score, breakdown, hybridWarning } = scoreJob(fields, config);

    if (score < 0) {
      excluded++;
      if (verbose) console.log(`\n  [${board.name}][EXCL] ${fields.title} — ${breakdown}`);
      continue;
    }

    if (score < minScore) {
      belowThreshold++;
      if (verbose) console.log(`\n  [${board.name}][LOW ${score}] ${fields.title} — ${breakdown}`);
      continue;
    }

    if (minSalary > 0 && !includeUnlistedSalary) {
      belowSalary++;
      if (verbose) console.log(`\n  [${board.name}][SAL] ${fields.title} — ${fields.salary}`);
      continue;
    }

    if (hybridWarning && config.hybrid.action === "exclude") {
      skippedLocation++;
      if (verbose) console.log(`\n  [${board.name}][HYB] ${fields.title} — ${hybridWarning}`);
      continue;
    }

    if (!passesLocationFilter(fields, remoteOnly, config)) {
      skippedLocation++;
      continue;
    }

    results.push({ ...fields, source: board.name, score, scoreBreakdown: breakdown, hybridWarning });
  }

  console.log(`  [${board.name}] Matches: ${results.length} | Excluded: ${excluded} | Low: ${belowThreshold}${minSalary > 0 ? ` | Salary: ${belowSalary}` : ""} | Location: ${skippedLocation}\n`);
  return results;
}

// --- Dispatch ---

export async function fetchBoardJobs(
  board: BoardConfig,
  daysBack: number,
  remoteOnly: boolean,
  limit: number,
  minScore: number,
  minSalary: number,
  includeUnlistedSalary: boolean,
  verbose: boolean,
  config: ResolvedConfig,
): Promise<ScoredJob[]> {
  switch (board.type) {
    case "sitemap": {
      const entries = await fetchSitemap(board, daysBack);
      return fetchJobDetails(board, entries, remoteOnly, limit, minScore, minSalary, includeUnlistedSalary, verbose, config);
    }
    case "greenhouse":
      return fetchGreenhouseJobs(board, daysBack, remoteOnly, limit, minScore, minSalary, includeUnlistedSalary, verbose, config);
    case "rss":
      return fetchRssJobs(board, daysBack, remoteOnly, limit, minScore, minSalary, includeUnlistedSalary, verbose, config);
    default: {
      const _exhaustive: never = board;
      throw new Error(`Unknown board type: ${(_exhaustive as any).type}`);
    }
  }
}
