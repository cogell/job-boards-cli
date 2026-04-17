import type { BoardConfig } from "../types.js";
import { idealist } from "./idealist.js";
import { techjobsforgood } from "./techjobsforgood.js";
import { codeforamerica } from "./codeforamerica.js";
import { weworkremotely } from "./weworkremotely.js";

export const boards: Record<string, BoardConfig> = {
  idealist,
  techjobsforgood,
  codeforamerica,
  weworkremotely,
};

export const allBoardNames = Object.keys(boards);
