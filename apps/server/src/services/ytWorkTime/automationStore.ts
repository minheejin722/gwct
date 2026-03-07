import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { YTWorkAutoMode } from "@gwct/shared";

export interface StoredYtWorkAutomation {
  version: 1;
  mode: YTWorkAutoMode;
  armedAt: string | null;
  updatedAt: string | null;
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(currentDir, "../../../data");
const configDir = path.join(dataDir, "config");
const configFile = path.join(configDir, "yt_work_time_automation.json");

export function defaultYtWorkAutomationState(): StoredYtWorkAutomation {
  return {
    version: 1,
    mode: "off",
    armedAt: null,
    updatedAt: null,
  };
}

function normalizeMode(value: unknown): YTWorkAutoMode {
  if (value === "full_auto" || value === "reserve_day" || value === "reserve_night") {
    return value;
  }
  return "off";
}

function normalizeIsoText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeStoredAutomationState(input: Partial<StoredYtWorkAutomation> | null | undefined): StoredYtWorkAutomation {
  const mode = normalizeMode(input?.mode);
  return {
    version: 1,
    mode,
    armedAt: mode === "off" ? null : normalizeIsoText(input?.armedAt),
    updatedAt: normalizeIsoText(input?.updatedAt),
  };
}

export async function loadYtWorkAutomationState(): Promise<StoredYtWorkAutomation> {
  try {
    const raw = await readFile(configFile, "utf8");
    return normalizeStoredAutomationState(JSON.parse(raw) as Partial<StoredYtWorkAutomation>);
  } catch {
    return defaultYtWorkAutomationState();
  }
}

export async function saveYtWorkAutomationState(state: StoredYtWorkAutomation): Promise<void> {
  await mkdir(configDir, { recursive: true });
  await writeFile(configFile, JSON.stringify(normalizeStoredAutomationState(state), null, 2), "utf8");
}

export async function clearYtWorkAutomationStateForTest(): Promise<void> {
  await rm(configFile, { force: true });
}
