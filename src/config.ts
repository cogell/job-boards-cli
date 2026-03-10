import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { stringify as toYaml, parse as parseYaml } from "yaml";
import { SCORING_DEFAULTS, REMOTE_DEFAULTS } from "./defaults.js";
import type { BoardConfig } from "./types.js";

// --- Config types ---

export interface ScoringWeights {
  titleStrong: number;
  titleModerate: number;
  descriptionSignal: number;
  highSignalBonus: number;
  highSignalThreshold: number;
  highSignalScoreCeiling: number;
}

export interface ScoringConfig {
  weights: ScoringWeights;
  titleStrong: string[];
  titleModerate: string[];
  descriptionSignals: string[];
  exclusions: string[];
}

export interface RemoteConfig {
  terms: string[];
}

export interface LocationConfig {
  allowRemote: boolean;
  allowUnlisted: boolean;
  include: string[];
}

export interface BoardOverride {
  name?: string;
  sitemapUrl?: string;
  slugHints?: string[];
}

/** What the user writes in their YAML config file */
interface UserConfig {
  extends?: "defaults";
  minSalary?: number;
  includeUnlistedSalary?: boolean;
  scoring?: {
    weights?: Partial<ScoringWeights>;
    titleStrong?: string[];
    titleModerate?: string[];
    descriptionSignals?: string[];
    exclusions?: string[];
  };
  boards?: Record<string, BoardOverride>;
  remote?: { terms?: string[] };
  location?: {
    allowRemote?: boolean;
    allowUnlisted?: boolean;
    include?: string[];
  };
}

/** Fully resolved config ready for use */
export interface ResolvedConfig {
  scoring: ScoringConfig;
  remote: RemoteConfig;
  location: LocationConfig | null;
  minSalary: number;
  includeUnlistedSalary: boolean;
  boardOverrides: Record<string, BoardOverride>;
  shouldExtend: boolean;
  configPath: string | null;
}

// --- Config file discovery ---

const CONFIG_NAMES = [
  "job-boards-cli.yml",
  "job-boards-cli.yaml",
  ".job-boards-cli.yml",
  ".job-boards-cli.yaml",
];

function findConfigFile(): string | null {
  for (const name of CONFIG_NAMES) {
    const p = join(process.cwd(), name);
    if (existsSync(p)) return p;
  }

  const configDir = join(homedir(), ".config", "job-boards-cli");
  for (const name of ["config.yml", "config.yaml"]) {
    const p = join(configDir, name);
    if (existsSync(p)) return p;
  }

  return null;
}

// --- Merging ---

function mergeArrays(defaults: string[], user: string[]): string[] {
  return [...new Set([...defaults, ...user])];
}

// --- Load & resolve ---

export function loadConfig(configPath?: string): ResolvedConfig {
  const filePath = configPath || findConfigFile();

  // No config file — use all defaults
  if (!filePath) {
    return {
      scoring: { ...SCORING_DEFAULTS },
      remote: { ...REMOTE_DEFAULTS },
      location: null,
      minSalary: 0,
      includeUnlistedSalary: true,
      boardOverrides: {},
      shouldExtend: false,
      configPath: null,
    };
  }

  if (!existsSync(filePath)) {
    console.error(`Config file not found: ${filePath}`);
    process.exit(1);
  }

  const raw = readFileSync(filePath, "utf-8");
  const user: UserConfig = parseYaml(raw) || {};
  const ext = user.extends === "defaults";

  // Resolve scoring
  const scoring: ScoringConfig = {
    weights: { ...SCORING_DEFAULTS.weights, ...user.scoring?.weights },
    titleStrong: user.scoring?.titleStrong
      ? ext ? mergeArrays(SCORING_DEFAULTS.titleStrong, user.scoring.titleStrong) : user.scoring.titleStrong
      : [...SCORING_DEFAULTS.titleStrong],
    titleModerate: user.scoring?.titleModerate
      ? ext ? mergeArrays(SCORING_DEFAULTS.titleModerate, user.scoring.titleModerate) : user.scoring.titleModerate
      : [...SCORING_DEFAULTS.titleModerate],
    descriptionSignals: user.scoring?.descriptionSignals
      ? ext ? mergeArrays(SCORING_DEFAULTS.descriptionSignals, user.scoring.descriptionSignals) : user.scoring.descriptionSignals
      : [...SCORING_DEFAULTS.descriptionSignals],
    exclusions: user.scoring?.exclusions
      ? ext ? mergeArrays(SCORING_DEFAULTS.exclusions, user.scoring.exclusions) : user.scoring.exclusions
      : [...SCORING_DEFAULTS.exclusions],
  };

  // Resolve remote
  const remote: RemoteConfig = {
    terms: user.remote?.terms
      ? ext ? mergeArrays(REMOTE_DEFAULTS.terms, user.remote.terms) : user.remote.terms
      : [...REMOTE_DEFAULTS.terms],
  };

  // Resolve location (null if not configured — falls back to --remote flag)
  const location: LocationConfig | null = user.location
    ? {
        allowRemote: user.location.allowRemote ?? true,
        allowUnlisted: user.location.allowUnlisted ?? true,
        include: user.location.include
          ? user.location.include.map((t) => t.toLowerCase())
          : [],
      }
    : null;

  return {
    scoring,
    remote,
    location,
    minSalary: user.minSalary || 0,
    includeUnlistedSalary: user.includeUnlistedSalary ?? true,
    boardOverrides: user.boards || {},
    shouldExtend: ext,
    configPath: filePath,
  };
}

// --- Resolve board configs with overrides ---

export function resolveBoards(
  builtIn: Record<string, BoardConfig>,
  config: ResolvedConfig,
): Record<string, BoardConfig> {
  const resolved: Record<string, BoardConfig> = {};

  // Start with built-in boards
  for (const [key, board] of Object.entries(builtIn)) {
    resolved[key] = { ...board };
  }

  // Apply overrides / add new boards
  for (const [key, override] of Object.entries(config.boardOverrides)) {
    if (resolved[key]) {
      // Existing board — apply overrides
      if (override.name) resolved[key].name = override.name;
      if (override.sitemapUrl) resolved[key].sitemapUrl = override.sitemapUrl;
      if (override.slugHints) {
        resolved[key].slugHints = config.shouldExtend
          ? [...new Set([...resolved[key].slugHints, ...override.slugHints])]
          : override.slugHints;
      }
    } else {
      // New board — require all fields
      if (!override.name || !override.sitemapUrl || !override.slugHints) {
        console.error(
          `Board "${key}" in config requires name, sitemapUrl, and slugHints`,
        );
        process.exit(1);
      }
      resolved[key] = {
        name: override.name,
        sitemapUrl: override.sitemapUrl,
        slugHints: override.slugHints,
      };
    }
  }

  return resolved;
}

// --- Init: generate starter config ---

export function generateInitConfig(outputPath: string) {
  if (existsSync(outputPath)) {
    console.error(`Config file already exists: ${outputPath}`);
    process.exit(1);
  }

  const starter = `# job-boards-cli configuration
# Docs: https://github.com/cogell/job-boards-cli

# Set to "defaults" to merge your values WITH the built-in keywords.
# Omit to replace defaults entirely for each section you provide.
# extends: defaults

# Minimum annual salary floor — jobs listing below this are excluded.
# Hourly/weekly/monthly salaries are normalized to annual for comparison.
# Set to 0 or omit to disable.
# minSalary: 100000

# When minSalary is active, include jobs that don't list a salary? (default: true)
# includeUnlistedSalary: true

# Scoring rules — controls how jobs are ranked
# scoring:
#   weights:
#     titleStrong: 50          # Points per strong title keyword match
#     titleModerate: 25        # Points per moderate title keyword match
#     descriptionSignal: 3     # Points per description keyword match
#     highSignalBonus: 15      # Bonus when description has many tech signals
#     highSignalThreshold: 8   # Number of description signals to trigger bonus
#     highSignalScoreCeiling: 25  # Only apply bonus if score is below this
#
#   # Job titles containing these get +titleStrong points
#   titleStrong:
#     - "software engineer"
#     - "frontend"
#
#   # Job titles containing these get +titleModerate points
#   titleModerate:
#     - "product manager"
#     - "data scientist"
#
#   # Keywords in job descriptions that signal a tech role
#   descriptionSignals:
#     - "react"
#     - "typescript"
#     - "python"
#
#   # Job titles containing these are excluded entirely
#   exclusions:
#     - "executive director"
#     - "social worker"

# Board-specific overrides and custom boards
# boards:
#   idealist:
#     slugHints:
#       - "engineer"
#       - "my-custom-slug"
#
#   # Add a new board (requires name, sitemapUrl, slugHints)
#   myboard:
#     name: "My Board"
#     sitemapUrl: "https://example.com/sitemap.xml"
#     slugHints:
#       - "/jobs/"

# Terms used to detect remote positions
# remote:
#   terms:
#     - "remote"
#     - "telecommute"

# Location filter — when set, replaces the --remote flag with fine-grained control.
# Jobs must match at least one criterion to be included.
# location:
#   allowRemote: true        # Include remote jobs (detected via remote.terms)
#   allowUnlisted: true      # Include jobs with no specified location
#   include:                 # Include jobs whose location contains any of these (case-insensitive)
#     - "New York"
#     - "NYC"
#     - "Brooklyn"
#     - "San Francisco"
`;

  writeFileSync(outputPath, starter, "utf-8");
  console.log(`Created config file: ${outputPath}`);
  console.log(`\nEdit it to customize scoring, keywords, and boards.`);
  console.log(`Use --show-config to see the resolved configuration.`);
  console.log(`Use --show-defaults to see all built-in default values.`);
}

// --- Show resolved config / defaults ---

export function showDefaults() {
  const defaults = {
    scoring: SCORING_DEFAULTS,
    remote: REMOTE_DEFAULTS,
  };
  console.log(toYaml(defaults, { lineWidth: 120 }));
}

export function showResolvedConfig(config: ResolvedConfig) {
  if (config.configPath) {
    console.log(`# Loaded from: ${config.configPath}`);
    console.log(`# extends: ${config.shouldExtend ? "defaults" : "(none)"}\n`);
  } else {
    console.log("# No config file found — using built-in defaults\n");
  }

  const display: Record<string, unknown> = {
    minSalary: config.minSalary || "(disabled)",
    includeUnlistedSalary: config.includeUnlistedSalary,
    scoring: config.scoring,
    remote: config.remote,
    ...(config.location ? { location: config.location } : {}),
    boardOverrides: Object.keys(config.boardOverrides).length > 0
      ? config.boardOverrides
      : "(none)",
  };
  console.log(toYaml(display, { lineWidth: 120 }));
}
