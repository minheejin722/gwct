import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type YtMonitorState = "NORMAL" | "LOW";
export type WeatherNormalizedState = "none" | "partial" | "all";

export interface GwctEtaMonitorConfig {
  enabled: boolean;
  trackingCount: number;
  lastTrackedSignature: string | null;
  lastChangedAt: string | null;
}

import { normalizeProgressThresholdPercent } from "@gwct/shared";

export interface GcRemainingMonitorRule {
  enabled: boolean;
  threshold: number;
}

export interface ProgressPercentMonitorRule {
  enabled: boolean;
  thresholdPercent: number;
}

export interface EquipmentYtMonitorConfig {
  enabled: boolean;
  threshold: number;
  stateInitialized: boolean;
  state: YtMonitorState | null;
}

export interface EquipmentGcStaffMonitorConfig {
  enabled: boolean;
}

export interface EquipmentMonitorConfig {
  yt: EquipmentYtMonitorConfig;
  gcStaff: EquipmentGcStaffMonitorConfig;
}

export interface YeosuPilotageMonitorConfig {
  enabled: boolean;
  lastRawText: string | null;
  lastNormalizedState: WeatherNormalizedState | null;
  lastChangedAt: string | null;
}

export interface MonitorSettings {
  gwctEtaMonitor: GwctEtaMonitorConfig;
  gcRemainingMonitors: Record<string, GcRemainingMonitorRule>;
  gcProgressMonitors: Record<string, ProgressPercentMonitorRule>;
  gcTotalProgressMonitor: ProgressPercentMonitorRule;
  equipmentMonitor: EquipmentMonitorConfig;
  yeosuPilotageMonitor: YeosuPilotageMonitorConfig;
}

export interface MonitorSettingsInput {
  gwctEtaMonitor?: Partial<GwctEtaMonitorConfig>;
  gcRemainingMonitors?: Record<string, Partial<GcRemainingMonitorRule>>;
  gcProgressMonitors?: Record<string, Partial<ProgressPercentMonitorRule>>;
  gcTotalProgressMonitor?: Partial<ProgressPercentMonitorRule>;
  equipmentMonitor?: {
    yt?: Partial<EquipmentYtMonitorConfig>;
    gcStaff?: Partial<EquipmentGcStaffMonitorConfig>;
  };
  yeosuPilotageMonitor?: Partial<YeosuPilotageMonitorConfig>;
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(currentDir, "../../../data");
const configDir = path.join(dataDir, "config");
const configFile = path.join(configDir, "monitor_settings.json");

const GC_KEYS = Array.from({ length: 10 }, (_, index) => String(181 + index));
const DEFAULT_GC_RULE: GcRemainingMonitorRule = {
  enabled: false,
  threshold: 20,
};
const DEFAULT_PROGRESS_PERCENT_RULE: ProgressPercentMonitorRule = {
  enabled: false,
  thresholdPercent: 100,
};

const DEFAULT_CONFIG: MonitorSettings = {
  gwctEtaMonitor: {
    enabled: false,
    trackingCount: 11,
    lastTrackedSignature: null,
    lastChangedAt: null,
  },
  gcRemainingMonitors: Object.fromEntries(
    GC_KEYS.map((gc) => [gc, { ...DEFAULT_GC_RULE }]),
  ) as Record<string, GcRemainingMonitorRule>,
  gcProgressMonitors: Object.fromEntries(
    GC_KEYS.map((gc) => [gc, { ...DEFAULT_PROGRESS_PERCENT_RULE }]),
  ) as Record<string, ProgressPercentMonitorRule>,
  gcTotalProgressMonitor: {
    ...DEFAULT_PROGRESS_PERCENT_RULE,
  },
  equipmentMonitor: {
    yt: {
      enabled: false,
      threshold: 25,
      stateInitialized: false,
      state: null,
    },
    gcStaff: {
      enabled: false,
    },
  },
  yeosuPilotageMonitor: {
    enabled: false,
    lastRawText: null,
    lastNormalizedState: null,
    lastChangedAt: null,
  },
};

function normalizeInt(value: unknown, fallback: number, min = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.trunc(parsed));
}

function normalizeTrackingCount(value: unknown, fallback: number): number {
  const parsed = normalizeInt(value, fallback, 1);
  return Math.min(11, Math.max(1, parsed));
}

function normalizePercent(value: unknown, fallback: number): number {
  return normalizeProgressThresholdPercent(Number(value), fallback);
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  return fallback;
}

function normalizeYtState(value: unknown): YtMonitorState | null {
  if (value === "NORMAL" || value === "LOW") {
    return value;
  }
  return null;
}

function normalizeWeatherState(value: unknown): WeatherNormalizedState | null {
  if (value === "none" || value === "partial" || value === "all") {
    return value;
  }
  return null;
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeConfig(input: Partial<MonitorSettings> | null | undefined): MonitorSettings {
  const gcRemainingMonitors: Record<string, GcRemainingMonitorRule> = {};
  for (const gc of GC_KEYS) {
    const fromInput = input?.gcRemainingMonitors?.[gc];
    const fromDefault = DEFAULT_CONFIG.gcRemainingMonitors[gc] || DEFAULT_GC_RULE;
    gcRemainingMonitors[gc] = {
      enabled: normalizeBoolean(fromInput?.enabled, fromDefault.enabled),
      threshold: normalizeInt(fromInput?.threshold, fromDefault.threshold, 0),
    };
  }

  const gcProgressMonitors: Record<string, ProgressPercentMonitorRule> = {};
  for (const gc of GC_KEYS) {
    const fromInput = input?.gcProgressMonitors?.[gc];
    const fromDefault = DEFAULT_CONFIG.gcProgressMonitors[gc] || DEFAULT_PROGRESS_PERCENT_RULE;
    gcProgressMonitors[gc] = {
      enabled: normalizeBoolean(fromInput?.enabled, fromDefault.enabled),
      thresholdPercent: normalizePercent(fromInput?.thresholdPercent, fromDefault.thresholdPercent),
    };
  }

  const ytState = normalizeYtState(input?.equipmentMonitor?.yt?.state);
  const ytStateInitialized = Boolean(input?.equipmentMonitor?.yt?.stateInitialized && ytState);

  return {
    gwctEtaMonitor: {
      enabled: normalizeBoolean(input?.gwctEtaMonitor?.enabled, DEFAULT_CONFIG.gwctEtaMonitor.enabled),
      trackingCount: normalizeTrackingCount(
        input?.gwctEtaMonitor?.trackingCount,
        DEFAULT_CONFIG.gwctEtaMonitor.trackingCount,
      ),
      lastTrackedSignature: normalizeText(input?.gwctEtaMonitor?.lastTrackedSignature),
      lastChangedAt: normalizeText(input?.gwctEtaMonitor?.lastChangedAt),
    },
    gcRemainingMonitors,
    gcProgressMonitors,
    gcTotalProgressMonitor: {
      enabled: normalizeBoolean(
        input?.gcTotalProgressMonitor?.enabled,
        DEFAULT_CONFIG.gcTotalProgressMonitor.enabled,
      ),
      thresholdPercent: normalizePercent(
        input?.gcTotalProgressMonitor?.thresholdPercent,
        DEFAULT_CONFIG.gcTotalProgressMonitor.thresholdPercent,
      ),
    },
    equipmentMonitor: {
      yt: {
        enabled: normalizeBoolean(input?.equipmentMonitor?.yt?.enabled, DEFAULT_CONFIG.equipmentMonitor.yt.enabled),
        threshold: normalizeInt(
          input?.equipmentMonitor?.yt?.threshold,
          DEFAULT_CONFIG.equipmentMonitor.yt.threshold,
          0,
        ),
        stateInitialized: ytStateInitialized,
        state: ytStateInitialized ? ytState : null,
      },
      gcStaff: {
        enabled: normalizeBoolean(
          input?.equipmentMonitor?.gcStaff?.enabled,
          DEFAULT_CONFIG.equipmentMonitor.gcStaff.enabled,
        ),
      },
    },
    yeosuPilotageMonitor: {
      enabled: normalizeBoolean(
        input?.yeosuPilotageMonitor?.enabled,
        DEFAULT_CONFIG.yeosuPilotageMonitor.enabled,
      ),
      lastRawText: normalizeText(input?.yeosuPilotageMonitor?.lastRawText),
      lastNormalizedState: normalizeWeatherState(input?.yeosuPilotageMonitor?.lastNormalizedState),
      lastChangedAt: normalizeText(input?.yeosuPilotageMonitor?.lastChangedAt),
    },
  };
}

function mergeConfig(current: MonitorSettings, patch: MonitorSettingsInput): MonitorSettings {
  const gcMerged: Record<string, GcRemainingMonitorRule> = {};
  for (const gc of GC_KEYS) {
    gcMerged[gc] = {
      ...current.gcRemainingMonitors[gc],
      ...(patch.gcRemainingMonitors?.[gc] || {}),
    };
  }

  const gcProgressMerged: Record<string, ProgressPercentMonitorRule> = {};
  for (const gc of GC_KEYS) {
    gcProgressMerged[gc] = {
      ...current.gcProgressMonitors[gc],
      ...(patch.gcProgressMonitors?.[gc] || {}),
    };
  }

  const merged: Partial<MonitorSettings> = {
    ...current,
    gwctEtaMonitor: {
      ...current.gwctEtaMonitor,
      ...(patch.gwctEtaMonitor || {}),
    },
    gcRemainingMonitors: gcMerged,
    gcProgressMonitors: gcProgressMerged,
    gcTotalProgressMonitor: {
      ...current.gcTotalProgressMonitor,
      ...(patch.gcTotalProgressMonitor || {}),
    },
    equipmentMonitor: {
      yt: {
        ...current.equipmentMonitor.yt,
        ...(patch.equipmentMonitor?.yt || {}),
      },
      gcStaff: {
        ...current.equipmentMonitor.gcStaff,
        ...(patch.equipmentMonitor?.gcStaff || {}),
      },
    },
    yeosuPilotageMonitor: {
      ...current.yeosuPilotageMonitor,
      ...(patch.yeosuPilotageMonitor || {}),
    },
  };

  return normalizeConfig(merged);
}

export function gcKeyFromNo(gc: number): string {
  return String(gc);
}

export function listSupportedGcKeys(): string[] {
  return [...GC_KEYS];
}

export function isSupportedGc(gc: number): boolean {
  return gc >= 181 && gc <= 190 && Number.isInteger(gc);
}

export async function loadMonitorSettings(): Promise<MonitorSettings> {
  try {
    const raw = await readFile(configFile, "utf8");
    const parsed = JSON.parse(raw) as Partial<MonitorSettings>;
    return normalizeConfig(parsed);
  } catch {
    return normalizeConfig(DEFAULT_CONFIG);
  }
}

export async function saveMonitorSettings(input: MonitorSettingsInput): Promise<MonitorSettings> {
  const current = await loadMonitorSettings();
  const merged = mergeConfig(current, input);
  await mkdir(configDir, { recursive: true });
  await writeFile(configFile, JSON.stringify(merged, null, 2), "utf8");
  return merged;
}

export async function setYtMonitorState(
  state: YtMonitorState,
  stateInitialized = true,
): Promise<MonitorSettings> {
  return saveMonitorSettings({
    equipmentMonitor: {
      yt: {
        state,
        stateInitialized,
      },
    },
  });
}

export async function setGwctEtaObservedState(input: {
  lastTrackedSignature: string | null;
  lastChangedAt?: string | null;
}): Promise<MonitorSettings> {
  return saveMonitorSettings({
    gwctEtaMonitor: {
      lastTrackedSignature: input.lastTrackedSignature,
      lastChangedAt: input.lastChangedAt || null,
    },
  });
}

export async function setYeosuObservedState(input: {
  lastRawText: string | null;
  lastNormalizedState: WeatherNormalizedState;
  lastChangedAt?: string | null;
}): Promise<MonitorSettings> {
  return saveMonitorSettings({
    yeosuPilotageMonitor: {
      lastRawText: input.lastRawText,
      lastNormalizedState: input.lastNormalizedState,
      lastChangedAt: input.lastChangedAt || null,
    },
  });
}

export function defaultMonitorSettings(): MonitorSettings {
  return normalizeConfig(DEFAULT_CONFIG);
}
