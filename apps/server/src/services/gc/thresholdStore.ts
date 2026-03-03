import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { GcWorkType } from "./latestStore.js";

export interface GcThresholdOverride {
  dischargeThreshold?: number;
  loadThreshold?: number;
}

export interface GcThresholdConfig {
  dischargeThreshold: number;
  loadThreshold: number;
  overrides: Record<string, GcThresholdOverride>;
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(currentDir, "../../../data");
const configDir = path.join(dataDir, "config");
const configFile = path.join(configDir, "gc_thresholds.json");

const DEFAULT_CONFIG: GcThresholdConfig = {
  dischargeThreshold: 20,
  loadThreshold: 20,
  overrides: {},
};

function normalizeNumber(input: unknown, fallback: number): number {
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(0, Math.trunc(parsed));
}

function normalizeConfig(input: Partial<GcThresholdConfig> | null | undefined): GcThresholdConfig {
  const base = {
    dischargeThreshold: normalizeNumber(input?.dischargeThreshold, DEFAULT_CONFIG.dischargeThreshold),
    loadThreshold: normalizeNumber(input?.loadThreshold, DEFAULT_CONFIG.loadThreshold),
    overrides: {},
  } as GcThresholdConfig;

  const overrides = input?.overrides || {};
  for (const [key, value] of Object.entries(overrides)) {
    const gc = Number(key);
    if (!Number.isInteger(gc) || gc < 181 || gc > 190) {
      continue;
    }
    const override: GcThresholdOverride = {};
    if (value?.dischargeThreshold !== undefined) {
      override.dischargeThreshold = normalizeNumber(value.dischargeThreshold, base.dischargeThreshold);
    }
    if (value?.loadThreshold !== undefined) {
      override.loadThreshold = normalizeNumber(value.loadThreshold, base.loadThreshold);
    }
    base.overrides[String(gc)] = override;
  }

  return base;
}

export async function loadGcThresholdConfig(): Promise<GcThresholdConfig> {
  try {
    const raw = await readFile(configFile, "utf8");
    return normalizeConfig(JSON.parse(raw) as GcThresholdConfig);
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveGcThresholdConfig(input: Partial<GcThresholdConfig>): Promise<GcThresholdConfig> {
  const current = await loadGcThresholdConfig();
  const merged = normalizeConfig({
    dischargeThreshold: input.dischargeThreshold ?? current.dischargeThreshold,
    loadThreshold: input.loadThreshold ?? current.loadThreshold,
    overrides: {
      ...current.overrides,
      ...(input.overrides || {}),
    },
  });

  await mkdir(configDir, { recursive: true });
  await writeFile(configFile, JSON.stringify(merged, null, 2), "utf8");
  return merged;
}

export function resolveGcThreshold(config: GcThresholdConfig, gc: number, workType: GcWorkType): number {
  const override = config.overrides[String(gc)];
  if (workType === "discharge") {
    return override?.dischargeThreshold ?? config.dischargeThreshold;
  }
  return override?.loadThreshold ?? config.loadThreshold;
}
