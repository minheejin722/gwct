import type { ScheduleFocusItem } from "./latestStore.js";

export interface GwctEtaObservedStateInput {
  items: ScheduleFocusItem[];
  trackingCount: number;
  previousSignature: string | null;
  previousChangedAt: string | null;
  observedAt: string;
}

export interface GwctEtaObservedStateResult {
  signature: string | null;
  lastChangedAt: string | null;
  changed: boolean;
}

function normalizeTrackingCount(trackingCount: number): number {
  if (!Number.isFinite(trackingCount)) {
    return 1;
  }
  return Math.min(11, Math.max(1, Math.trunc(trackingCount)));
}

export function buildTrackedScheduleFocusSignature(
  items: ScheduleFocusItem[],
  trackingCount: number,
): string | null {
  const limit = normalizeTrackingCount(trackingCount);
  const tracked = items.slice(0, limit).map((item) => ({
    indexInWatchWindow: item.indexInWatchWindow,
    voyage: item.voyage,
    vesselName: item.vesselName,
    eta: item.eta,
    etaNormalized: item.etaNormalized,
    rowColor: item.rowColor,
    rowClass: item.rowClass,
  }));

  if (!tracked.length) {
    return null;
  }

  return JSON.stringify(tracked);
}

export function computeNextGwctEtaObservedState(
  input: GwctEtaObservedStateInput,
): GwctEtaObservedStateResult {
  const signature = buildTrackedScheduleFocusSignature(input.items, input.trackingCount);
  const changed = signature !== input.previousSignature;

  return {
    signature,
    changed,
    lastChangedAt: changed ? input.observedAt : input.previousChangedAt,
  };
}
