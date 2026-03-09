import type { BoardConfig } from "../types.js";
import { idealist } from "./idealist.js";
import { techjobsforgood } from "./techjobsforgood.js";

export const boards: Record<string, BoardConfig> = {
  idealist,
  techjobsforgood,
};

export const allBoardNames = Object.keys(boards);
