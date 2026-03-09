import type { ScoredJob } from "./types.js";

export function displayResults(jobs: ScoredJob[], verbose: boolean) {
  if (jobs.length === 0) {
    console.log("No matching jobs found. Try --min-score 20 or --remote false to widen the search.");
    return;
  }

  console.log(`${"=".repeat(80)}`);
  console.log(`  Found ${jobs.length} matching jobs (sorted by relevance)`);
  console.log(`${"=".repeat(80)}\n`);

  for (const job of jobs) {
    const scoreBar = "\u2588".repeat(Math.min(Math.round(job.score / 10), 10)) + "\u2591".repeat(Math.max(10 - Math.round(job.score / 10), 0));
    console.log(`  [${scoreBar}] ${job.score}pts  (${job.source})`);
    console.log(`  ${job.title}`);
    console.log(`  ${job.org}`);
    console.log(`  \u{1F4CD} ${job.location} | ${job.locationType}`);
    console.log(`  \u{1F4B0} ${job.salary} | ${job.employmentType}`);
    console.log(`  \u{1F4C5} Posted: ${job.datePosted} | Expires: ${job.validThrough}`);
    console.log(`  \u{1F517} ${job.url}`);
    if (verbose) console.log(`  \u{1F9EE} ${job.scoreBreakdown}`);
    console.log(`  ${"-".repeat(76)}`);
  }
}
