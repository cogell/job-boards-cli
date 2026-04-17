import { join } from "node:path";
import { boards as builtInBoards } from "./boards/index.js";
import { fetchBoardJobs } from "./scraper.js";
import { displayResults } from "./display.js";
import { loadConfig, resolveBoards, generateInitConfig, showDefaults, showResolvedConfig } from "./config.js";
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

  return {
    boardArg: flags.board || "all",
    days: parseInt(flags.days || "7", 10),
    remote: flags.remote !== "false",
    limit: parseInt(flags.limit || "50", 10),
    minScore: parseInt(flags["min-score"] || "30", 10),
    minSalary: flags["min-salary"] ? parseInt(flags["min-salary"], 10) : undefined,
    includeUnlistedSalary: flags["include-unlisted-salary"] !== undefined ? flags["include-unlisted-salary"] !== "false" : undefined,
    verbose: flags.verbose === "true",
    configPath: flags.config,
    init: flags.init === "true",
    showConfig: flags["show-config"] === "true",
    showDefaults: flags["show-defaults"] === "true",
  };
}

// --- Main ---

async function main() {
  const args = parseArgs();

  // --init: generate starter config file and exit
  if (args.init) {
    generateInitConfig(join(process.cwd(), "job-boards-cli.yml"));
    return;
  }

  // Load config
  const config = loadConfig(args.configPath);

  // --show-defaults: print built-in defaults and exit
  if (args.showDefaults) {
    showDefaults();
    return;
  }

  // --show-config: print resolved config and exit
  if (args.showConfig) {
    showResolvedConfig(config);
    return;
  }

  // Resolve boards (built-in + config overrides)
  const resolvedBoardMap = resolveBoards(builtInBoards, config);
  const allBoardNames = Object.keys(resolvedBoardMap);

  // Select boards from --board flag
  const selectedBoards = args.boardArg === "all"
    ? allBoardNames
    : args.boardArg.split(",").map((b) => b.trim());

  for (const name of selectedBoards) {
    if (!resolvedBoardMap[name]) {
      console.error(`Unknown board: "${name}". Available: ${allBoardNames.join(", ")}`);
      process.exit(1);
    }
  }

  // Resolve salary options: CLI flags override config
  const minSalary = args.minSalary ?? config.minSalary;
  const includeUnlistedSalary = args.includeUnlistedSalary ?? config.includeUnlistedSalary;

  console.log(`\n  Job Boards CLI`);
  console.log(`  ---------------`);
  if (config.configPath) console.log(`  Config: ${config.configPath}`);
  console.log(`  Boards: ${selectedBoards.join(", ")}`);
  console.log(`  Days back: ${args.days}`);
  if (config.location) {
    const parts: string[] = [];
    if (config.location.allowRemote) parts.push("remote");
    if (config.location.allowUnlisted) parts.push("unlisted");
    if (config.location.include.length > 0) parts.push(...config.location.include);
    console.log(`  Location: ${parts.join(", ")}`);
  } else {
    console.log(`  Remote only: ${args.remote}`);
  }
  console.log(`  Hybrid: ${config.hybrid.action} (penalty: -${config.hybrid.penalty}pts)`);
  console.log(`  Min score: ${args.minScore}`);
  console.log(`  Min salary: ${minSalary > 0 ? `$${minSalary.toLocaleString()}/yr` : "(disabled)"}${minSalary > 0 ? ` (unlisted: ${includeUnlistedSalary ? "include" : "exclude"})` : ""}`);
  console.log(`  Max results: ${args.limit}\n`);

  const allJobs: ScoredJob[] = [];

  for (const boardName of selectedBoards) {
    const board = resolvedBoardMap[boardName];
    const jobs = await fetchBoardJobs(board, args.days, args.remote, args.limit, args.minScore, minSalary, includeUnlistedSalary, args.verbose, config);
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
  const limited = deduped.slice(0, args.limit);

  displayResults(limited, args.verbose);
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
