import { derivePreciseProgressPercent, deriveProgressPercent, type CraneStatus } from "@gwct/shared";

export interface GcProgressSnapshotItem {
  gc: number;
  craneId: string;
  dischargeDone: number | null;
  loadDone: number | null;
  dischargeRemaining: number | null;
  loadRemaining: number | null;
  totalDone: number | null;
  totalRemaining: number | null;
  progressPercent: number | null;
  preciseProgressPercent: number | null;
}

export interface GcProgressSnapshot {
  items: GcProgressSnapshotItem[];
  overallPercent: number | null;
}

function sumDefinedNumbers(values: Array<number | null | undefined>): number | null {
  let total = 0;
  let hasNumber = false;
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      total += value;
      hasNumber = true;
    }
  }
  return hasNumber ? total : null;
}

function parseGcNo(craneId: string): number | null {
  const matched = craneId.toUpperCase().replace(/\s+/g, "").match(/^GC(\d{3})$/);
  if (!matched) {
    return null;
  }
  const parsed = Number(matched[1]);
  return Number.isInteger(parsed) ? parsed : null;
}

export function buildGcProgressSnapshot(rows: CraneStatus[]): GcProgressSnapshot {
  const groups = new Map<string, CraneStatus[]>();

  for (const row of rows) {
    const bucket = groups.get(row.craneId) || [];
    bucket.push(row);
    groups.set(row.craneId, bucket);
  }

  const items = Array.from(groups.entries())
    .map(([craneId, bucket]) => {
      const gc = parseGcNo(craneId);
      if (gc === null) {
        return null;
      }
      const dischargeDone = sumDefinedNumbers(bucket.map((row) => row.dischargeDone));
      const loadDone = sumDefinedNumbers(bucket.map((row) => row.loadDone));
      const dischargeRemaining = sumDefinedNumbers(bucket.map((row) => row.dischargeRemaining));
      const loadRemaining = sumDefinedNumbers(bucket.map((row) => row.loadRemaining));
      const totalDone = sumDefinedNumbers([dischargeDone, loadDone]);
      const totalRemaining =
        sumDefinedNumbers(bucket.map((row) => row.totalRemaining)) ?? sumDefinedNumbers([dischargeRemaining, loadRemaining]);
      const fallbackProgress =
        bucket.find((row) => typeof row.progressPercent === "number" && Number.isFinite(row.progressPercent))
          ?.progressPercent ?? null;

      return {
        gc,
        craneId,
        dischargeDone,
        loadDone,
        dischargeRemaining,
        loadRemaining,
        totalDone,
        totalRemaining,
        progressPercent: deriveProgressPercent(totalDone, totalRemaining, fallbackProgress),
        preciseProgressPercent: derivePreciseProgressPercent(totalDone, totalRemaining, fallbackProgress),
      } satisfies GcProgressSnapshotItem;
    })
    .filter((item): item is GcProgressSnapshotItem => item !== null)
    .sort((left, right) => left.gc - right.gc);

  const overallDone = sumDefinedNumbers(items.map((item) => item.totalDone));
  const overallRemaining = sumDefinedNumbers(items.map((item) => item.totalRemaining));

  return {
    items,
    overallPercent: derivePreciseProgressPercent(overallDone, overallRemaining),
  };
}
