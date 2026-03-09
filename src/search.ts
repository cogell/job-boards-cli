import { boards, allBoardNames } from "./boards/index.js";
import { fetchSitemap, fetchJobDetails } from "./scraper.js";
import { displayResults } from "./display.js";
import type { ScoredJob } from "./types.js";

// --- CLI Args ---

function parseArgs() {
  const args = process.argv.slice(2);
  const flags: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].replace("--", "");
      const val = args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : "true";
      flags[key] = val;
      if (val !== "true") i++;
    }
  }

  // --board idealist,techjobsforgood  or  --board all  (default: all)
  const boardArg = flags.board || "all";
  const selectedBoards = boardArg === "all"
    ? allBoardNames
    : boardArg.split(",").map((b) => b.trim());

  // Validate board names
  for (const name of selectedBoards) {
    if (!boards[name]) {
      console.error(`Unknown board: "${name}". Available: ${allBoardNames.join(", ")}`);
      process.exit(1);
    }
  }

  return {
    boards: selectedBoards,
    days: parseInt(flags.days || "7", 10),
    remote: flags.remote !== "false",
    limit: parseInt(flags.limit || "50", 10),
    minScore: parseInt(flags["min-score"] || "30", 10),
    verbose: flags.verbose === "true",
  };
}

// --- Main ---

async function main() {
  const config = parseArgs();

  console.log(`\n  Job Boards CLI`);
  console.log(`  ---------------`);
  console.log(`  Boards: ${config.boards.join(", ")}`);
  console.log(`  Days back: ${config.days}`);
  console.log(`  Remote only: ${config.remote}`);
  console.log(`  Min score: ${config.minScore}`);
  console.log(`  Max results: ${config.limit}\n`);

  const allJobs: ScoredJob[] = [];

  for (const boardName of config.boards) {
    const board = boards[boardName];
    const entries = await fetchSitemap(board, config.days);
    const jobs = await fetchJobDetails(board, entries, config.remote, config.limit, config.minScore, config.verbose);
    allJobs.push(...jobs);
  }

  // Deduplicate by title+org (keep highest score / most recent)
  const seen = new Map<string, ScoredJob>();
  for (const job of allJobs) {
    const key = `${job.title.toLowerCase()}::${job.org.toLowerCase()}`;
    const existing = seen.get(key);
    if (!existing || job.score > existing.score || job.datePosted > existing.datePosted) {
      seen.set(key, job);
    }
  }
  const deduped = [...seen.values()];
  const dupeCount = allJobs.length - deduped.length;
  if (dupeCount > 0) {
    console.log(`Removed ${dupeCount} duplicate listing(s) across boards.`);
  }

  // Sort by score descending, then by date
  deduped.sort((a, b) => b.score - a.score || b.datePosted.localeCompare(a.datePosted));

  // Apply final limit across all boards
  const limited = deduped.slice(0, config.limit);

  displayResults(limited, config.verbose);
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
