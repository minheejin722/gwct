import type { CraneStatus } from "@gwct/shared";

type CraneListRow = Pick<CraneStatus, "craneId" | "vesselName" | "source" | "seenAt" | "signature">;

export function buildCraneRenderKey(row: CraneListRow): string {
  return [
    row.craneId,
    row.vesselName || "-",
    row.source,
    row.seenAt,
    row.signature,
  ].join("|");
}

function findDuplicates(values: string[]): string[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([value]) => value);
}

export function reportDuplicateCraneRows(rows: CraneListRow[]): void {
  if (!__DEV__) {
    return;
  }

  const duplicateCraneIds = findDuplicates(rows.map((row) => row.craneId));
  const duplicateRenderKeys = findDuplicates(rows.map((row) => buildCraneRenderKey(row)));

  if (!duplicateCraneIds.length && !duplicateRenderKeys.length) {
    return;
  }

  console.warn("[CraneStatus] duplicate rows detected", {
    duplicateCraneIds,
    duplicateRenderKeys,
    rowCount: rows.length,
  });
}
