import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type ScheduleRowColor = "green" | "yellow" | "cyan" | "unknown";

export interface ScheduleFocusItem {
  indexInWatchWindow: number;
  voyage: string;
  vesselName: string;
  eta: string | null;
  etaNormalized: string | null;
  rowColor: ScheduleRowColor;
  rowClass: string | null;
}

export interface ScheduleFocusSnapshot {
  source: "gwct_schedule_list";
  sourceUrl: string;
  capturedAt: string;
  startReason: "first_yellow" | "first_non_green" | "none";
  items: ScheduleFocusItem[];
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(currentDir, "../../../data");
const latestDir = path.join(dataDir, "latest");
const latestFile = path.join(latestDir, "gwct_schedule_list_focus.json");

export async function saveScheduleFocusSnapshot(snapshot: ScheduleFocusSnapshot): Promise<void> {
  await mkdir(latestDir, { recursive: true });
  await writeFile(latestFile, JSON.stringify(snapshot, null, 2), "utf8");
}

export async function loadScheduleFocusSnapshot(): Promise<ScheduleFocusSnapshot | null> {
  try {
    const raw = await readFile(latestFile, "utf8");
    return JSON.parse(raw) as ScheduleFocusSnapshot;
  } catch {
    return null;
  }
}

export function summarizeScheduleFocus(snapshot: ScheduleFocusSnapshot): string {
  const parts = snapshot.items.map((item) => {
    return `${item.indexInWatchWindow}) ${item.voyage} ${item.vesselName} ETA=${item.etaNormalized || "xx"}`;
  });
  return `[SCHEDULE11] ${parts.join(" | ")}`;
}
