import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CraneStatus } from "@gwct/shared";

const EMPTY_TEXT_MARKERS = new Set(["-", "—", "N/A", "NA"]);
const GC_NUMBERS = Array.from({ length: 10 }, (_, index) => 181 + index);

export interface GcAssignmentStateEntry {
  gc: number;
  activeVesselName: string | null;
  pendingVesselNames: string[];
  lastEvidenceAt: string | null;
  lastSeenAt: string | null;
}

export interface GcAssignmentState {
  version: 1;
  items: Record<string, GcAssignmentStateEntry>;
}

export interface GcStatusSnapshotGroup {
  seenAt: string;
  items: CraneStatus[];
}

export interface GcAssignmentBackfillRepository {
  getLatestCraneStatusSnapshotGroups(
    source: "gwct_work_status",
    limit: number,
  ): Promise<GcStatusSnapshotGroup[]>;
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(currentDir, "../../../data");
const configDir = path.join(dataDir, "config");
const stateFile = path.join(configDir, "gc_assignment_state.json");

function createDefaultEntry(gc: number): GcAssignmentStateEntry {
  return {
    gc,
    activeVesselName: null,
    pendingVesselNames: [],
    lastEvidenceAt: null,
    lastSeenAt: null,
  };
}

export function createDefaultGcAssignmentState(): GcAssignmentState {
  return {
    version: 1,
    items: Object.fromEntries(
      GC_NUMBERS.map((gc) => [String(gc), createDefaultEntry(gc)]),
    ) as Record<string, GcAssignmentStateEntry>,
  };
}

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
  if (!Number.isInteger(parsed) || parsed < 181 || parsed > 190) {
    return null;
  }
  return parsed;
}

function rowTotalRemaining(row: CraneStatus): number | null {
  if (typeof row.totalRemaining === "number") {
    return row.totalRemaining;
  }
  if (row.dischargeRemaining !== null || row.loadRemaining !== null) {
    return (row.dischargeRemaining ?? 0) + (row.loadRemaining ?? 0);
  }
  return null;
}

function uniqueSorted(values: Iterable<string>): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function toGcVesselTotals(rows: CraneStatus[]): Map<number, Map<string, number>> {
  const map = new Map<number, Map<string, number>>();

  for (const row of rows) {
    const gc = parseGcNoFromCraneId(row.craneId);
    const vesselName = normalizeOptionalText(row.vesselName);
    const totalRemaining = rowTotalRemaining(row);
    if (gc === null || !vesselName || totalRemaining === null) {
      continue;
    }
    const bucket = map.get(gc) || new Map<string, number>();
    bucket.set(vesselName, totalRemaining);
    map.set(gc, bucket);
  }

  return map;
}

function normalizeStateEntry(input: unknown, gc: number): GcAssignmentStateEntry {
  const raw = input as Partial<GcAssignmentStateEntry> | null | undefined;
  return {
    gc,
    activeVesselName: normalizeOptionalText(raw?.activeVesselName),
    pendingVesselNames: uniqueSorted(
      Array.isArray(raw?.pendingVesselNames)
        ? raw.pendingVesselNames
            .map((value) => normalizeOptionalText(typeof value === "string" ? value : null))
            .filter((value): value is string => value !== null)
        : [],
    ),
    lastEvidenceAt: typeof raw?.lastEvidenceAt === "string" ? raw.lastEvidenceAt : null,
    lastSeenAt: typeof raw?.lastSeenAt === "string" ? raw.lastSeenAt : null,
  };
}

function normalizeState(input: unknown): GcAssignmentState {
  const raw = input as Partial<GcAssignmentState> | null | undefined;
  const base = createDefaultGcAssignmentState();
  for (const gc of GC_NUMBERS) {
    base.items[String(gc)] = normalizeStateEntry(raw?.items?.[String(gc)], gc);
  }
  return base;
}

export function isGcAssignmentStateEmpty(state: GcAssignmentState | null | undefined): boolean {
  if (!state) {
    return true;
  }
  return GC_NUMBERS.every((gc) => {
    const entry = state.items[String(gc)];
    return !entry?.activeVesselName && (!entry?.pendingVesselNames || entry.pendingVesselNames.length === 0);
  });
}

export async function saveGcAssignmentState(state: GcAssignmentState): Promise<void> {
  await mkdir(configDir, { recursive: true });
  await writeFile(stateFile, JSON.stringify(state, null, 2), "utf8");
}

export async function loadGcAssignmentState(): Promise<GcAssignmentState> {
  try {
    const raw = await readFile(stateFile, "utf8");
    return normalizeState(JSON.parse(raw));
  } catch {
    return createDefaultGcAssignmentState();
  }
}

function buildNextEntry(
  gc: number,
  previousEntry: GcAssignmentStateEntry,
  previousTotals: Map<string, number>,
  currentTotals: Map<string, number>,
  seenAt: string,
): GcAssignmentStateEntry {
  const previousPositiveNames = uniqueSorted(
    Array.from(previousTotals.entries())
      .filter(([, total]) => total > 0)
      .map(([vesselName]) => vesselName),
  );
  const currentPositiveNames = uniqueSorted(
    Array.from(currentTotals.entries())
      .filter(([, total]) => total > 0)
      .map(([vesselName]) => vesselName),
  );
  const decreasedPositiveNames = currentPositiveNames.filter((vesselName) => {
    const previousTotal = previousTotals.get(vesselName);
    const currentTotal = currentTotals.get(vesselName);
    return (
      typeof previousTotal === "number" &&
      typeof currentTotal === "number" &&
      currentTotal < previousTotal
    );
  });

  const previousActive = normalizeOptionalText(previousEntry.activeVesselName);
  const currentActive =
    previousActive && currentPositiveNames.includes(previousActive) ? previousActive : null;

  let activeVesselName: string | null = null;
  let pendingVesselNames: string[] = [];
  let lastEvidenceAt = previousEntry.lastEvidenceAt;

  if (currentPositiveNames.length === 0) {
    activeVesselName = null;
    pendingVesselNames = [];
  } else if (decreasedPositiveNames.length === 1) {
    activeVesselName = decreasedPositiveNames[0] || null;
    pendingVesselNames = currentPositiveNames.filter((vesselName) => vesselName !== activeVesselName);
    lastEvidenceAt = seenAt;
  } else if (decreasedPositiveNames.length > 1) {
    if (currentActive) {
      activeVesselName = currentActive;
      pendingVesselNames = currentPositiveNames.filter((vesselName) => vesselName !== activeVesselName);
    } else {
      activeVesselName = null;
      pendingVesselNames = currentPositiveNames;
    }
  } else if (currentActive) {
    activeVesselName = currentActive;
    pendingVesselNames = currentPositiveNames.filter((vesselName) => vesselName !== activeVesselName);
  } else if (
    currentPositiveNames.length > 1 ||
    previousPositiveNames.length > 1 ||
    previousEntry.pendingVesselNames.length > 0
  ) {
    activeVesselName = null;
    pendingVesselNames = currentPositiveNames;
  } else {
    activeVesselName = null;
    pendingVesselNames = [];
  }

  return {
    gc,
    activeVesselName,
    pendingVesselNames,
    lastEvidenceAt,
    lastSeenAt: seenAt,
  };
}

export function buildNextGcAssignmentState(
  previousState: GcAssignmentState | null | undefined,
  previousRows: CraneStatus[],
  currentRows: CraneStatus[],
  seenAt: string,
): GcAssignmentState {
  const state = normalizeState(previousState);
  const previousTotalsByGc = toGcVesselTotals(previousRows);
  const currentTotalsByGc = toGcVesselTotals(currentRows);

  for (const gc of GC_NUMBERS) {
    state.items[String(gc)] = buildNextEntry(
      gc,
      state.items[String(gc)] || createDefaultEntry(gc),
      previousTotalsByGc.get(gc) || new Map<string, number>(),
      currentTotalsByGc.get(gc) || new Map<string, number>(),
      seenAt,
    );
  }

  return state;
}

export async function ensureGcAssignmentState(
  repo: GcAssignmentBackfillRepository,
): Promise<GcAssignmentState> {
  const current = await loadGcAssignmentState();
  if (!isGcAssignmentStateEmpty(current)) {
    return current;
  }

  const groups = await repo.getLatestCraneStatusSnapshotGroups("gwct_work_status", 10);
  if (groups.length < 2) {
    return current;
  }

  const orderedGroups = [...groups].reverse();
  let backfilled = current;

  for (let index = 1; index < orderedGroups.length; index += 1) {
    const previous = orderedGroups[index - 1];
    const next = orderedGroups[index];
    if (!previous || !next) {
      continue;
    }
    backfilled = buildNextGcAssignmentState(backfilled, previous.items, next.items, next.seenAt);
  }

  await saveGcAssignmentState(backfilled);
  return backfilled;
}

export async function clearGcAssignmentStateForTest(): Promise<void> {
  await saveGcAssignmentState(createDefaultGcAssignmentState());
}
