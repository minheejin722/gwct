import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { YTUnitSnapshot } from "@gwct/shared";

export interface GcEquipmentState {
  gcNo: number;
  equipmentId: string;
  driverName: string | null;
  hkName: string | null;
  loginTime: string | null;
  stopReason: string | null;
}

export interface EquipmentFocusSnapshot {
  source: "gwct_equipment_status";
  sourceUrl: string;
  capturedAt: string;
  ytCount: number;
  ytKnown: number;
  ytUnits: YTUnitSnapshot[];
  gcStates: GcEquipmentState[];
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(currentDir, "../../../data");
const latestDir = path.join(dataDir, "latest");
const latestFile = path.join(latestDir, "gwct_equipment_status_focus.json");

export async function saveEquipmentLatestSnapshot(snapshot: EquipmentFocusSnapshot): Promise<void> {
  await mkdir(latestDir, { recursive: true });
  await writeFile(latestFile, JSON.stringify(snapshot, null, 2), "utf8");
}

export async function loadEquipmentLatestSnapshot(): Promise<EquipmentFocusSnapshot | null> {
  try {
    const raw = await readFile(latestFile, "utf8");
    return JSON.parse(raw) as EquipmentFocusSnapshot;
  } catch {
    return null;
  }
}

export function summarizeEquipmentFocus(snapshot: EquipmentFocusSnapshot): string {
  const active = snapshot.ytUnits.filter((row) => row.semanticState === "active").length;
  const stopped = snapshot.ytUnits.filter((row) => row.semanticState === "stopped").length;
  const loggedOut = snapshot.ytUnits.filter((row) => row.semanticState === "logged_out").length;
  const parts = snapshot.gcStates.map((row) => {
    return `GC${row.gcNo} driver=${row.driverName || "-"} hk=${row.hkName || "-"} stop=${row.stopReason || "-"}`;
  });
  return `[EQUIP] YT=${snapshot.ytCount}/${snapshot.ytKnown} active=${active} stopped=${stopped} logged_out=${loggedOut} | ${parts.join(" | ")}`;
}
