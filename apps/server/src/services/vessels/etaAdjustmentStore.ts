import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface VesselEtaAdjustmentRecord {
  vesselKey: string;
  vesselName: string;
  voyage: string | null;
  occurredAt: string;
  previousEta: string;
  currentEta: string;
  deltaMinutes: number;
  direction: "earlier" | "later";
  crossedDate: boolean;
  humanMessage: string;
  adjustmentCount: number;
}

interface VesselEtaAdjustmentState {
  version: 1;
  items: Record<string, VesselEtaAdjustmentRecord>;
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(currentDir, "../../../data");
const configDir = path.join(dataDir, "config");
const stateFile = path.join(configDir, "vessel_eta_adjustments.json");

async function loadState(): Promise<VesselEtaAdjustmentState> {
  try {
    const raw = await readFile(stateFile, "utf8");
    const parsed = JSON.parse(raw) as VesselEtaAdjustmentState;
    if (!parsed || parsed.version !== 1 || typeof parsed.items !== "object" || !parsed.items) {
      return { version: 1, items: {} };
    }
    return parsed;
  } catch {
    return { version: 1, items: {} };
  }
}

async function saveState(state: VesselEtaAdjustmentState): Promise<void> {
  await mkdir(configDir, { recursive: true });
  await writeFile(stateFile, JSON.stringify(state, null, 2), "utf8");
}

export async function saveVesselEtaAdjustmentRecord(record: VesselEtaAdjustmentRecord): Promise<void> {
  const state = await loadState();
  state.items[record.vesselKey] = record;
  await saveState(state);
}

export async function loadVesselEtaAdjustmentRecords(): Promise<VesselEtaAdjustmentRecord[]> {
  const state = await loadState();
  return Object.values(state.items);
}

export async function clearVesselEtaAdjustmentRecordsForTest(): Promise<void> {
  await saveState({ version: 1, items: {} });
}
