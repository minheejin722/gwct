import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type GcWorkType = "discharge" | "load";

export interface GcRemainingItem {
  gc: number;
  dischargeRemaining: number | null;
  loadRemaining: number | null;
  remainingSubtotal: number | null;
}

export interface GcRemainingSnapshot {
  source: "gwct_gc_remaining";
  sourceUrl: string;
  capturedAt: string;
  items: GcRemainingItem[];
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(currentDir, "../../../data");
const latestDir = path.join(dataDir, "latest");
const latestFile = path.join(latestDir, "gwct_gc_remaining.json");

function normalizeSnapshot(input: unknown): GcRemainingSnapshot | null {
  if (!input || typeof input !== "object") {
    return null;
  }
  const raw = input as {
    source?: string;
    sourceUrl?: string;
    capturedAt?: string;
    items?: Array<Record<string, unknown>>;
  };

  if (!Array.isArray(raw.items)) {
    return null;
  }

  // Backward compatibility: older format stored two rows per GC with workType.
  const hasLegacyWorkTypeRows = raw.items.some((item) => typeof item?.workType === "string");
  if (hasLegacyWorkTypeRows) {
    const byGc = new Map<number, { dischargeRemaining: number | null; loadRemaining: number | null }>();
    raw.items.forEach((item) => {
      const gc = Number(item.gc);
      if (!Number.isInteger(gc) || gc < 181 || gc > 190) {
        return;
      }
      const current = byGc.get(gc) || { dischargeRemaining: null, loadRemaining: null };
      const workType = String(item.workType || "");
      const value = item.remainingSubtotal;
      const subtotal = typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : null;
      if (workType === "discharge") {
        current.dischargeRemaining = subtotal;
      } else if (workType === "load") {
        current.loadRemaining = subtotal;
      }
      byGc.set(gc, current);
    });

    const items: GcRemainingItem[] = [];
    for (let gc = 181; gc <= 190; gc += 1) {
      const row = byGc.get(gc) || { dischargeRemaining: null, loadRemaining: null };
      items.push({
        gc,
        dischargeRemaining: row.dischargeRemaining,
        loadRemaining: row.loadRemaining,
        remainingSubtotal:
          row.dischargeRemaining !== null || row.loadRemaining !== null
            ? (row.dischargeRemaining ?? 0) + (row.loadRemaining ?? 0)
            : null,
      });
    }

    return {
      source: "gwct_gc_remaining",
      sourceUrl: typeof raw.sourceUrl === "string" ? raw.sourceUrl : "",
      capturedAt: typeof raw.capturedAt === "string" ? raw.capturedAt : new Date().toISOString(),
      items,
    };
  }

  const items: GcRemainingItem[] = raw.items
    .map((item) => {
      const gc = Number(item.gc);
      if (!Number.isInteger(gc) || gc < 181 || gc > 190) {
        return null;
      }
      const discharge = typeof item.dischargeRemaining === "number" ? Math.trunc(item.dischargeRemaining) : null;
      const load = typeof item.loadRemaining === "number" ? Math.trunc(item.loadRemaining) : null;
      const subtotal =
        typeof item.remainingSubtotal === "number"
          ? Math.trunc(item.remainingSubtotal)
          : discharge !== null || load !== null
            ? (discharge ?? 0) + (load ?? 0)
            : null;
      return {
        gc,
        dischargeRemaining: discharge,
        loadRemaining: load,
        remainingSubtotal: subtotal,
      } satisfies GcRemainingItem;
    })
    .filter((row): row is GcRemainingItem => row !== null);

  return {
    source: "gwct_gc_remaining",
    sourceUrl: typeof raw.sourceUrl === "string" ? raw.sourceUrl : "",
    capturedAt: typeof raw.capturedAt === "string" ? raw.capturedAt : new Date().toISOString(),
    items,
  };
}

export async function saveGcLatestSnapshot(snapshot: GcRemainingSnapshot): Promise<void> {
  await mkdir(latestDir, { recursive: true });
  await writeFile(latestFile, JSON.stringify(snapshot, null, 2), "utf8");
}

export async function loadGcLatestSnapshot(): Promise<GcRemainingSnapshot | null> {
  try {
    const raw = await readFile(latestFile, "utf8");
    return normalizeSnapshot(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function summarizeGcRange(snapshot: GcRemainingSnapshot, from = 183, to = 188): string {
  const parts: string[] = [];
  for (let gc = from; gc <= to; gc += 1) {
    const row = snapshot.items.find((item) => item.gc === gc);
    const d = row?.dischargeRemaining ?? null;
    const l = row?.loadRemaining ?? null;
    parts.push(`GC${gc} D:${d ?? "xx"} L:${l ?? "xx"}`);
  }
  return parts.join(" | ");
}
