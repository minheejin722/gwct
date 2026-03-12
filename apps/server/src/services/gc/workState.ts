import type { CraneStatus } from "@gwct/shared";
import { sha256 } from "../../lib/hash.js";
import type { EquipmentFocusSnapshot, GcEquipmentState } from "../equipment/latestStore.js";
import type { GcAssignmentState, GcAssignmentStateEntry } from "./assignmentStore.js";
import type { GcRemainingItem, GcRemainingSnapshot } from "./latestStore.js";

export type GcWorkState = "active" | "checking" | "scheduled" | "idle" | "unknown";

export interface GcCraneLiveRow extends CraneStatus {
  workState: GcWorkState;
  crewAssigned: boolean;
}

const EMPTY_TEXT_MARKERS = new Set(["-", "N/A", "NA"]);
const MAX_WORK_STATUS_SKEW_MS = 15 * 60 * 1000;

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = (value || "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }
  const compactUpper = normalized.replace(/\s+/g, "").toUpperCase();
  if (EMPTY_TEXT_MARKERS.has(compactUpper)) {
    return null;
  }
  return normalized;
}

function parseGcNoFromCraneId(craneId: string): number | null {
  const matched = craneId.toUpperCase().replace(/\s+/g, "").match(/^GC(\d{3})$/);
  if (!matched) {
    return null;
  }
  const parsed = Number(matched[1]);
  return Number.isInteger(parsed) ? parsed : null;
}

function buildGcRemainingMap(snapshot: GcRemainingSnapshot | null): Map<number, GcRemainingItem> {
  const map = new Map<number, GcRemainingItem>();
  for (const item of snapshot?.items || []) {
    map.set(item.gc, item);
  }
  return map;
}

function buildGcEquipmentMap(snapshot: EquipmentFocusSnapshot | null): Map<number, GcEquipmentState> {
  const map = new Map<number, GcEquipmentState>();
  for (const item of snapshot?.gcStates || []) {
    map.set(item.gcNo, item);
  }
  return map;
}

function buildGcAssignmentMap(snapshot: GcAssignmentState | null): Map<number, GcAssignmentStateEntry> {
  const map = new Map<number, GcAssignmentStateEntry>();
  for (let gc = 181; gc <= 190; gc += 1) {
    const item = snapshot?.items?.[String(gc)];
    if (item) {
      map.set(gc, item);
    }
  }
  return map;
}

function alignWorkStatusRowsToGcSnapshot(
  gcSnapshot: GcRemainingSnapshot | null,
  workStatusRows: CraneStatus[],
): CraneStatus[] {
  if (!gcSnapshot || workStatusRows.length === 0) {
    return workStatusRows;
  }

  const gcCapturedAtMs = Date.parse(gcSnapshot.capturedAt);
  if (!Number.isFinite(gcCapturedAtMs)) {
    return workStatusRows;
  }

  const latestWorkSeenAtMs = workStatusRows
    .map((row) => Date.parse(row.seenAt))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => right - left)[0];

  if (!Number.isFinite(latestWorkSeenAtMs)) {
    return workStatusRows;
  }

  return Math.abs(gcCapturedAtMs - latestWorkSeenAtMs) > MAX_WORK_STATUS_SKEW_MS ? [] : workStatusRows;
}

function hasPositiveRemaining(row: CraneStatus): boolean {
  if (typeof row.totalRemaining === "number") {
    return row.totalRemaining > 0;
  }
  return (row.dischargeRemaining ?? 0) > 0 || (row.loadRemaining ?? 0) > 0;
}

function hasRecordedDone(row: CraneStatus): boolean {
  return typeof row.dischargeDone === "number" || typeof row.loadDone === "number";
}

function compareWorkRows(left: CraneStatus, right: CraneStatus): number {
  const leftVessel = normalizeOptionalText(left.vesselName) || "";
  const rightVessel = normalizeOptionalText(right.vesselName) || "";
  return leftVessel.localeCompare(rightVessel) || left.signature.localeCompare(right.signature);
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
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

function buildGcPositiveWorkRowsMap(rows: CraneStatus[]): Map<number, CraneStatus[]> {
  const map = new Map<number, CraneStatus[]>();
  for (const row of rows) {
    const gc = parseGcNoFromCraneId(row.craneId);
    if (gc === null || !hasPositiveRemaining(row)) {
      continue;
    }
    const current = map.get(gc) || [];
    current.push(row);
    map.set(gc, current);
  }
  for (const [gc, bucket] of map) {
    map.set(gc, [...bucket].sort(compareWorkRows));
  }
  return map;
}

function buildGcInformativeWorkRowsMap(rows: CraneStatus[]): Map<number, CraneStatus[]> {
  const map = new Map<number, CraneStatus[]>();
  for (const row of rows) {
    const gc = parseGcNoFromCraneId(row.craneId);
    if (gc === null || (!hasPositiveRemaining(row) && !hasRecordedDone(row))) {
      continue;
    }
    const current = map.get(gc) || [];
    current.push(row);
    map.set(gc, current);
  }
  for (const [gc, bucket] of map) {
    map.set(gc, [...bucket].sort(compareWorkRows));
  }
  return map;
}

function aggregateWorkDone(rows: CraneStatus[]): { dischargeDone: number | null; loadDone: number | null } {
  return {
    dischargeDone: sumDefinedNumbers(rows.map((row) => row.dischargeDone)),
    loadDone: sumDefinedNumbers(rows.map((row) => row.loadDone)),
  };
}

function withCarry(base: number | null | undefined, carry: number): number | null {
  if (carry <= 0) {
    return typeof base === "number" ? base : null;
  }
  return (typeof base === "number" ? base : 0) + carry;
}

function listPositiveWorkVesselNames(rows: CraneStatus[]): string[] {
  return uniqueSorted(
    rows
      .map((row) => normalizeOptionalText(row.vesselName))
      .filter((value): value is string => value !== null),
  );
}

function resolveAssignedActiveVesselName(
  assignment: GcAssignmentStateEntry | null | undefined,
  currentPositiveVesselNames: string[],
): string | null {
  const active = normalizeOptionalText(assignment?.activeVesselName);
  if (!active) {
    return null;
  }
  return currentPositiveVesselNames.includes(active) ? active : null;
}

function resolvePendingVesselNames(
  assignment: GcAssignmentStateEntry | null | undefined,
  currentPositiveVesselNames: string[],
): string[] {
  return uniqueSorted(
    (assignment?.pendingVesselNames || [])
      .map((value) => normalizeOptionalText(value))
      .filter((value): value is string => value !== null && currentPositiveVesselNames.includes(value)),
  );
}

function deriveGcLiveRowWorkState(
  remainingSubtotal: number | null | undefined,
  equipmentState: GcEquipmentState | null | undefined,
  currentWorkRow: CraneStatus | null | undefined,
  gcWorkRows: CraneStatus[],
  assignment: GcAssignmentStateEntry | null | undefined,
): GcWorkState {
  if (remainingSubtotal === null || remainingSubtotal === undefined) {
    return "unknown";
  }
  if (remainingSubtotal <= 0) {
    return "idle";
  }
  if (!hasAssignedGcCrew(equipmentState)) {
    return "scheduled";
  }

  const currentPositiveVesselNames = listPositiveWorkVesselNames(gcWorkRows);
  const currentRowVesselName = normalizeOptionalText(currentWorkRow?.vesselName);
  const assignedActiveVesselName = resolveAssignedActiveVesselName(assignment, currentPositiveVesselNames);
  const pendingVesselNames = resolvePendingVesselNames(assignment, currentPositiveVesselNames);

  if (!currentRowVesselName || currentPositiveVesselNames.length === 0) {
    return "active";
  }

  if (currentPositiveVesselNames.length > 1) {
    if (assignedActiveVesselName) {
      return currentRowVesselName === assignedActiveVesselName ? "active" : "scheduled";
    }
    return "checking";
  }

  if (assignedActiveVesselName) {
    return currentRowVesselName === assignedActiveVesselName ? "active" : "scheduled";
  }

  if (pendingVesselNames.includes(currentRowVesselName)) {
    return "scheduled";
  }

  return "active";
}

export function hasAssignedGcCrew(state: GcEquipmentState | null | undefined): boolean {
  return Boolean(
    normalizeOptionalText(state?.driverName) ||
      normalizeOptionalText(state?.hkName) ||
      normalizeOptionalText(state?.loginTime),
  );
}

export function deriveGcWorkState(
  remainingSubtotal: number | null | undefined,
  equipmentState: GcEquipmentState | null | undefined,
): GcWorkState {
  if (remainingSubtotal === null || remainingSubtotal === undefined) {
    return "unknown";
  }
  if (remainingSubtotal <= 0) {
    return "idle";
  }
  return hasAssignedGcCrew(equipmentState) ? "active" : "scheduled";
}

export function buildGcCraneLiveRows(
  gcSnapshot: GcRemainingSnapshot | null,
  equipmentSnapshot: EquipmentFocusSnapshot | null,
  workStatusRows: CraneStatus[],
  assignmentState: GcAssignmentState | null = null,
): GcCraneLiveRow[] {
  const alignedWorkStatusRows = alignWorkStatusRowsToGcSnapshot(gcSnapshot, workStatusRows);
  const remainingByGc = buildGcRemainingMap(gcSnapshot);
  const equipmentByGc = buildGcEquipmentMap(equipmentSnapshot);
  const assignmentByGc = buildGcAssignmentMap(assignmentState);
  const positiveWorkRowsByGc = buildGcPositiveWorkRowsMap(alignedWorkStatusRows);
  const informativeWorkRowsByGc = buildGcInformativeWorkRowsMap(alignedWorkStatusRows);
  const seenAtFallback = gcSnapshot?.capturedAt || equipmentSnapshot?.capturedAt || new Date().toISOString();

  const rows: GcCraneLiveRow[] = [];

  for (let gc = 181; gc <= 190; gc += 1) {
    const craneId = `GC${gc}`;
    const remaining = remainingByGc.get(gc);
    const equipment = equipmentByGc.get(gc);
    const workRows = positiveWorkRowsByGc.get(gc) || [];
    const informativeWorkRows = informativeWorkRowsByGc.get(gc) || [];
    const assignment = assignmentByGc.get(gc);
    const crewAssigned = hasAssignedGcCrew(equipment);
    const aggregatedDone = aggregateWorkDone(informativeWorkRows);

    if (workRows.length > 1) {
      const positiveDone = aggregateWorkDone(workRows);
      const dischargeCarry = Math.max((aggregatedDone.dischargeDone ?? 0) - (positiveDone.dischargeDone ?? 0), 0);
      const loadCarry = Math.max((aggregatedDone.loadDone ?? 0) - (positiveDone.loadDone ?? 0), 0);
      workRows.forEach((workRow) => {
        const totalRemaining = workRow.totalRemaining ?? null;
        const workState = deriveGcLiveRowWorkState(totalRemaining, equipment, workRow, workRows, assignment);
        const isFirstRow = workRow === workRows[0];
        const rowBase: Omit<GcCraneLiveRow, "signature"> = {
          source: workRow.source,
          craneId,
          vesselName: workRow.vesselName ?? null,
          dischargeDone: isFirstRow ? withCarry(workRow.dischargeDone, dischargeCarry) : workRow.dischargeDone ?? null,
          loadDone: isFirstRow ? withCarry(workRow.loadDone, loadCarry) : workRow.loadDone ?? null,
          dischargeRemaining: workRow.dischargeRemaining ?? null,
          loadRemaining: workRow.loadRemaining ?? null,
          totalRemaining,
          progressPercent: workRow.progressPercent ?? null,
          seenAt: workRow.seenAt || gcSnapshot?.capturedAt || seenAtFallback,
          workState,
          crewAssigned,
        };

        rows.push({
          ...rowBase,
          signature: sha256(
            JSON.stringify({
              ...rowBase,
              driverName: equipment?.driverName ?? null,
              hkName: equipment?.hkName ?? null,
              loginTime: equipment?.loginTime ?? null,
            }),
          ),
        });
      });
      continue;
    }

    const workRow = workRows[0] || informativeWorkRows[0];
    const inferredZeroRemaining =
      remaining?.remainingSubtotal == null &&
      workRows.length === 0 &&
      (aggregatedDone.dischargeDone !== null || aggregatedDone.loadDone !== null)
        ? 0
        : null;
    const totalRemaining = remaining?.remainingSubtotal ?? workRow?.totalRemaining ?? inferredZeroRemaining;
    const workState = deriveGcLiveRowWorkState(totalRemaining, equipment, workRows[0], workRows, assignment);

    const rowBase: Omit<GcCraneLiveRow, "signature"> = {
      source: gcSnapshot?.source || workRow?.source || "gwct_gc_remaining",
      craneId,
      vesselName: workRow?.vesselName ?? null,
      dischargeDone: aggregatedDone.dischargeDone ?? null,
      loadDone: aggregatedDone.loadDone ?? null,
      dischargeRemaining: remaining?.dischargeRemaining ?? workRow?.dischargeRemaining ?? null,
      loadRemaining: remaining?.loadRemaining ?? workRow?.loadRemaining ?? null,
      totalRemaining,
      progressPercent: workRow?.progressPercent ?? null,
      seenAt: workRow?.seenAt || gcSnapshot?.capturedAt || seenAtFallback,
      workState,
      crewAssigned,
    };

    rows.push({
      ...rowBase,
      signature: sha256(
        JSON.stringify({
          ...rowBase,
          driverName: equipment?.driverName ?? null,
          hkName: equipment?.hkName ?? null,
          loginTime: equipment?.loginTime ?? null,
        }),
      ),
    });
  }

  return rows;
}
