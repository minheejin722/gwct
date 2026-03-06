import type { CraneStatus } from "@gwct/shared";
import { sha256 } from "../../lib/hash.js";
import type { EquipmentFocusSnapshot, GcEquipmentState } from "../equipment/latestStore.js";
import type { GcRemainingItem, GcRemainingSnapshot } from "./latestStore.js";
import { normalizeCraneLiveRows } from "./liveRows.js";

export type GcWorkState = "active" | "scheduled" | "idle" | "unknown";

export interface GcCraneLiveRow extends CraneStatus {
  workState: GcWorkState;
  crewAssigned: boolean;
}

const EMPTY_TEXT_MARKERS = new Set(["-", "—", "N/A", "NA"]);

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

function buildGcWorkRowMap(rows: CraneStatus[]): Map<number, CraneStatus> {
  const map = new Map<number, CraneStatus>();
  for (const row of normalizeCraneLiveRows(rows)) {
    const gc = parseGcNoFromCraneId(row.craneId);
    if (gc === null) {
      continue;
    }
    map.set(gc, row);
  }
  return map;
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
): GcCraneLiveRow[] {
  const remainingByGc = buildGcRemainingMap(gcSnapshot);
  const equipmentByGc = buildGcEquipmentMap(equipmentSnapshot);
  const workRowsByGc = buildGcWorkRowMap(workStatusRows);
  const seenAtFallback = gcSnapshot?.capturedAt || equipmentSnapshot?.capturedAt || new Date().toISOString();

  const rows: GcCraneLiveRow[] = [];

  for (let gc = 181; gc <= 190; gc += 1) {
    const craneId = `GC${gc}`;
    const remaining = remainingByGc.get(gc);
    const equipment = equipmentByGc.get(gc);
    const workRow = workRowsByGc.get(gc);
    const totalRemaining = remaining?.remainingSubtotal ?? workRow?.totalRemaining ?? null;
    const crewAssigned = hasAssignedGcCrew(equipment);
    const workState = deriveGcWorkState(totalRemaining, equipment);

    const rowBase: Omit<GcCraneLiveRow, "signature"> = {
      source: gcSnapshot?.source || workRow?.source || "gwct_gc_remaining",
      craneId,
      vesselName: workRow?.vesselName ?? null,
      dischargeDone: workRow?.dischargeDone ?? null,
      loadDone: workRow?.loadDone ?? null,
      dischargeRemaining: remaining?.dischargeRemaining ?? workRow?.dischargeRemaining ?? null,
      loadRemaining: remaining?.loadRemaining ?? workRow?.loadRemaining ?? null,
      totalRemaining,
      progressPercent: workRow?.progressPercent ?? null,
      seenAt: gcSnapshot?.capturedAt || workRow?.seenAt || seenAtFallback,
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
