export interface SitemapEntry {
  url: string;
  lastmod: string;
}

export interface JobFields {
  title: string;
  org: string;
  location: string;
  locationType: string;
  salary: string;
  salaryMin: number | null;
  employmentType: string;
  datePosted: string;
  validThrough: string;
  url: string;
  description: string;
}

export interface ScoredJob extends JobFields {
  source: string;
  score: number;
  scoreBreakdown: string;
  hybridWarning?: string;
}

interface BoardConfigBase {
  name: string;
}

export interface SitemapBoardConfig extends BoardConfigBase {
  type: "sitemap";
  sitemapUrl: string;
  slugHints: string[];
}

export interface GreenhouseBoardConfig extends BoardConfigBase {
  type: "greenhouse";
  boardId: string;
}

export interface RssBoardConfig extends BoardConfigBase {
  type: "rss";
  feedUrls: string[];
}

export type BoardConfig = SitemapBoardConfig | GreenhouseBoardConfig | RssBoardConfig;

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

export interface HybridConfig {
  terms: string[];
  penalty: number;
  action: "flag" | "exclude";
}

export interface BoardOverride {
  type?: "sitemap" | "greenhouse" | "rss";
  name?: string;
  sitemapUrl?: string;
  slugHints?: string[];
  boardId?: string;
  feedUrls?: string[];
}

export interface ResolvedConfig {
  scoring: ScoringConfig;
  remote: RemoteConfig;
  location: LocationConfig | null;
  hybrid: HybridConfig;
  minSalary: number;
  includeUnlistedSalary: boolean;
  boardOverrides: Record<string, BoardOverride>;
  shouldExtend: boolean;
  configPath: string | null;
}
