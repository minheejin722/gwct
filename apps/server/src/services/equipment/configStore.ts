import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type YtAlertState = "NORMAL" | "LOW";

export interface EquipmentRulesConfig {
  ytThresholdLow: number;
  ytThresholdRecover: number;
  ytStateInitialized: boolean;
  ytState: YtAlertState | null;
}

interface EquipmentRulesInput {
  ytThresholdLow?: number;
  ytThresholdRecover?: number;
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(currentDir, "../../../data");
const configDir = path.join(dataDir, "config");
const configFile = path.join(configDir, "equipment_rules.json");

const DEFAULT_CONFIG: EquipmentRulesConfig = {
  ytThresholdLow: 25,
  ytThresholdRecover: 27,
  ytStateInitialized: false,
  ytState: null,
};

function normalizeNumber(input: unknown, fallback: number): number {
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(0, Math.trunc(parsed));
}

function normalizeState(input: unknown): YtAlertState | null {
  if (input === "NORMAL" || input === "LOW") {
    return input;
  }
  return null;
}

function normalizeConfig(input: Partial<EquipmentRulesConfig> | null | undefined): EquipmentRulesConfig {
  const ytThresholdLow = normalizeNumber(input?.ytThresholdLow, DEFAULT_CONFIG.ytThresholdLow);
  const ytThresholdRecover = Math.max(
    ytThresholdLow,
    normalizeNumber(input?.ytThresholdRecover, DEFAULT_CONFIG.ytThresholdRecover),
  );
  const ytState = normalizeState(input?.ytState);
  const ytStateInitialized = Boolean(input?.ytStateInitialized && ytState);

  return {
    ytThresholdLow,
    ytThresholdRecover,
    ytStateInitialized,
    ytState: ytStateInitialized ? ytState : null,
  };
}

export async function loadEquipmentRulesConfig(): Promise<EquipmentRulesConfig> {
  try {
    const raw = await readFile(configFile, "utf8");
    return normalizeConfig(JSON.parse(raw) as EquipmentRulesConfig);
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveEquipmentRulesConfig(input: EquipmentRulesInput): Promise<EquipmentRulesConfig> {
  const current = await loadEquipmentRulesConfig();
  const merged = normalizeConfig({
    ...current,
    ytThresholdLow: input.ytThresholdLow ?? current.ytThresholdLow,
    ytThresholdRecover: input.ytThresholdRecover ?? current.ytThresholdRecover,
  });

  await mkdir(configDir, { recursive: true });
  await writeFile(configFile, JSON.stringify(merged, null, 2), "utf8");
  return merged;
}

export async function setEquipmentYtAlertState(state: YtAlertState): Promise<EquipmentRulesConfig> {
  const current = await loadEquipmentRulesConfig();
  const merged = normalizeConfig({
    ...current,
    ytStateInitialized: true,
    ytState: state,
  });

  await mkdir(configDir, { recursive: true });
  await writeFile(configFile, JSON.stringify(merged, null, 2), "utf8");
  return merged;
}
