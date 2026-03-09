import type { BoardConfig } from "../types.js";

export const techjobsforgood: BoardConfig = {
  name: "Tech Jobs for Good",
  sitemapUrl: "https://techjobsforgood.com/sitemap.xml",
  // TJFG is already a tech-focused board, so all job URLs are relevant.
  // Their sitemap mixes job pages (/jobs/NNN/) with category pages,
  // so we filter to just the job detail URLs.
  slugHints: ["/jobs/"],
};
