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
}

export interface BoardConfig {
  name: string;
  sitemapUrl: string;
  slugHints: string[];
}
