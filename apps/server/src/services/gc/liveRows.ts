import type { CraneStatus } from "@gwct/shared";

function parseCraneNo(craneId: string): number | null {
  const matched = craneId.match(/GC\s*(\d+)/i);
  if (!matched) {
    return null;
  }
  const parsed = Number(matched[1]);
  return Number.isInteger(parsed) ? parsed : null;
}

function countNonNull(values: Array<number | null>): number {
  return values.reduce<number>((count, value) => count + (value !== null ? 1 : 0), 0);
}

function rowScore(row: CraneStatus): [number, number, number, number] {
  const remainingFilled = countNonNull([row.dischargeRemaining, row.loadRemaining, row.totalRemaining]);
  const doneFilled = countNonNull([row.dischargeDone, row.loadDone]);
  const hasVessel = row.vesselName ? 1 : 0;
  const subtotal = row.totalRemaining ?? -1;
  return [remainingFilled, doneFilled, hasVessel, subtotal];
}

function isBetterRow(candidate: CraneStatus, current: CraneStatus): boolean {
  const candidateScore = rowScore(candidate);
  const currentScore = rowScore(current);
  for (let i = 0; i < candidateScore.length; i += 1) {
    if (candidateScore[i] > currentScore[i]) {
      return true;
    }
    if (candidateScore[i] < currentScore[i]) {
      return false;
    }
  }
  return false;
}

function compareCraneId(a: string, b: string): number {
  const aNo = parseCraneNo(a);
  const bNo = parseCraneNo(b);
  if (aNo !== null && bNo !== null) {
    return aNo - bNo;
  }
  return a.localeCompare(b);
}

export function normalizeCraneLiveRows(rows: CraneStatus[]): CraneStatus[] {
  const bestByCraneId = new Map<string, CraneStatus>();

  for (const row of rows) {
    const current = bestByCraneId.get(row.craneId);
    if (!current || isBetterRow(row, current)) {
      bestByCraneId.set(row.craneId, row);
    }
  }

  return Array.from(bestByCraneId.values()).sort((a, b) => compareCraneId(a.craneId, b.craneId));
}
