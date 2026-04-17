import type { RssBoardConfig } from "../types.js";

export const weworkremotely: RssBoardConfig = {
  type: "rss",
  name: "We Work Remotely",
  feedUrls: [
    "https://weworkremotely.com/categories/remote-programming-jobs.rss",
    "https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss",
    "https://weworkremotely.com/categories/remote-front-end-programming-jobs.rss",
    "https://weworkremotely.com/categories/remote-back-end-programming-jobs.rss",
    "https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss",
  ],
};
