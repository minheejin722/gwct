import { readFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";

export async function loadFixtureHtml(source: string, fixtureSet = "base"): Promise<string> {
  const candidates = [
    path.resolve(process.cwd(), "fixtures", fixtureSet, `${source}.html`),
    path.resolve(process.cwd(), "fixtures", `${source}.html`),
  ];

  for (const filePath of candidates) {
    try {
      return await readFile(filePath, "utf8");
    } catch {
      continue;
    }
  }

  throw new Error(`Fixture file not found for source=${source} set=${fixtureSet}`);
}

export function resolveMode(override?: "live" | "fixture"): "live" | "fixture" {
  return override || env.MODE;
}
