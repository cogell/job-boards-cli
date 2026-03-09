// Title keywords are strong signals — these mean the role IS a tech role
const TITLE_STRONG = [
  "software engineer",
  "software developer",
  "senior engineer",
  "staff engineer",
  "principal engineer",
  "tech lead",
  "engineering manager",
  "engineering director",
  "vp of engineering",
  "head of engineering",
  "full stack",
  "fullstack",
  "front end",
  "frontend",
  "back end",
  "backend",
  "devops",
  "sre",
  "site reliability",
  "platform engineer",
  "infrastructure engineer",
  "cloud engineer",
  "data engineer",
  "ml engineer",
  "machine learning engineer",
  "ai engineer",
  "product engineer",
  "web developer",
  "mobile developer",
  "ios developer",
  "android developer",
  "react developer",
  "node developer",
  "python developer",
];

// Title keywords that are relevant but weaker (could be tech-adjacent)
const TITLE_MODERATE = [
  "cto",
  "chief technology",
  "product manager",
  "technical project manager",
  "solutions architect",
  "solution architect",
  "systems architect",
  "technical lead",
  "technical director",
  "director of technology",
  "head of technology",
  "head of engineering",
  "director of engineering",
  "director of it",
  "it manager",
  "it director",
  "data scientist",
  "data analyst",
  "database administrator",
  "security engineer",
  "qa engineer",
  "test engineer",
];

// Description keywords that indicate a tech role when found in quantity
const DESC_TECH_SIGNALS = [
  "react", "typescript", "javascript", "python", "node.js", "nodejs",
  "aws", "gcp", "azure", "docker", "kubernetes", "terraform",
  "ci/cd", "git", "api", "rest", "graphql", "microservices",
  "agile", "scrum", "sprint", "pull request",
  "frontend", "backend", "full-stack", "fullstack",
  "postgresql", "mongodb", "redis", "sql",
  "machine learning", "deep learning", "llm", "ai model",
  "react native", "ios", "android", "mobile app",
  "html", "css", "sass", "webpack", "vite",
  "java", "go", "golang", "rust", "ruby", "rails",
  "django", "flask", "express", "next.js", "nextjs",
];

// Titles that should be excluded — these aren't tech roles even if they mention tech
const TITLE_EXCLUDE = [
  "director of operations",
  "director of development",
  "director of communications",
  "director of finance",
  "director of people",
  "director of programs",
  "director of fundraising",
  "director of marketing",
  "director of hr",
  "director of human resources",
  "associate director",
  "assistant director",
  "executive director",
  "executive assistant",
  "development director",
  "development manager",
  "development associate",
  "development coordinator",
  "fundraising",
  "grant writer",
  "social worker",
  "case manager",
  "program manager",
  "program director",
  "program coordinator",
  "program officer",
  "policy director",
  "policy analyst",
  "policy manager",
  "communications director",
  "communications manager",
  "outreach coordinator",
  "community organizer",
  "volunteer coordinator",
  "help desk technician",
  "office manager",
  "administrative",
  "receptionist",
  "accountant",
  "bookkeeper",
  "controller",
  "legal counsel",
  "attorney",
  "paralegal",
  "nurse",
  "physician",
  "therapist",
  "counselor",
  "teacher",
  "instructor",
  "tutor",
  "forester",
  "gardener",
  "custodian",
  "janitor",
  "driver",
  "cook",
  "chef",
  "membership assistant",
  "carbon management",
  "artistic operations",
];

// Word-boundary match — prevents "cto" matching inside "director"
function matchesWord(text: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}

export function scoreJob(job: { title: string; description: string }): { score: number; breakdown: string } {
  const titleLower = job.title.toLowerCase();
  const descLower = job.description.toLowerCase();
  let score = 0;
  const reasons: string[] = [];

  // Check exclusions first
  for (const excl of TITLE_EXCLUDE) {
    if (titleLower.includes(excl)) {
      return { score: -1, breakdown: `excluded: title contains "${excl}"` };
    }
  }

  // Strong title match: +50 per match
  for (const kw of TITLE_STRONG) {
    if (titleLower.includes(kw)) {
      score += 50;
      reasons.push(`title:strong "${kw}" +50`);
    }
  }

  // Moderate title match: +25 per match (use word boundaries for short terms)
  for (const kw of TITLE_MODERATE) {
    if (kw.length <= 4 ? matchesWord(titleLower, kw) : titleLower.includes(kw)) {
      score += 25;
      reasons.push(`title:moderate "${kw}" +25`);
    }
  }

  // Description tech signals: +3 per match (need many to matter)
  let descHits = 0;
  for (const signal of DESC_TECH_SIGNALS) {
    if (descLower.includes(signal)) {
      descHits++;
      score += 3;
    }
  }
  if (descHits > 0) {
    reasons.push(`desc:tech_signals x${descHits} +${descHits * 3}`);
  }

  // Bonus: if title has no strong/moderate match but description has 8+ tech signals,
  // it might still be a tech role with a weird title
  if (score < 25 && descHits >= 8) {
    score += 15;
    reasons.push(`desc:high_signal_bonus +15`);
  }

  return { score, breakdown: reasons.join(" | ") };
}

export function isRemote(job: { locationType: string; title: string; description: string }): boolean {
  const text = `${job.locationType} ${job.title}`.toLowerCase();
  return text.includes("remote") || text.includes("telecommute");
}
