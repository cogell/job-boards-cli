import type { ResolvedConfig } from "./config.js";

// Word-boundary match — prevents "cto" matching inside "director"
function matchesWord(text: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}

export function scoreJob(
  job: { title: string; description: string },
  config: ResolvedConfig,
): { score: number; breakdown: string } {
  const { scoring } = config;
  const titleLower = job.title.toLowerCase();
  const descLower = job.description.toLowerCase();
  let score = 0;
  const reasons: string[] = [];

  // Check exclusions first
  for (const excl of scoring.exclusions) {
    if (titleLower.includes(excl)) {
      return { score: -1, breakdown: `excluded: title contains "${excl}"` };
    }
  }

  // Strong title match
  for (const kw of scoring.titleStrong) {
    if (titleLower.includes(kw)) {
      score += scoring.weights.titleStrong;
      reasons.push(`title:strong "${kw}" +${scoring.weights.titleStrong}`);
    }
  }

  // Moderate title match (use word boundaries for short terms)
  for (const kw of scoring.titleModerate) {
    if (kw.length <= 4 ? matchesWord(titleLower, kw) : titleLower.includes(kw)) {
      score += scoring.weights.titleModerate;
      reasons.push(`title:moderate "${kw}" +${scoring.weights.titleModerate}`);
    }
  }

  // Description tech signals
  let descHits = 0;
  for (const signal of scoring.descriptionSignals) {
    if (descLower.includes(signal)) {
      descHits++;
      score += scoring.weights.descriptionSignal;
    }
  }
  if (descHits > 0) {
    reasons.push(`desc:tech_signals x${descHits} +${descHits * scoring.weights.descriptionSignal}`);
  }

  // Bonus: if title has no strong/moderate match but description has many tech signals,
  // it might still be a tech role with a weird title
  if (score < scoring.weights.highSignalScoreCeiling && descHits >= scoring.weights.highSignalThreshold) {
    score += scoring.weights.highSignalBonus;
    reasons.push(`desc:high_signal_bonus +${scoring.weights.highSignalBonus}`);
  }

  return { score, breakdown: reasons.join(" | ") };
}

export function isRemote(
  job: { locationType: string; title: string; description: string },
  config: ResolvedConfig,
): boolean {
  const text = `${job.locationType} ${job.title}`.toLowerCase();
  return config.remote.terms.some((term) => text.includes(term));
}
