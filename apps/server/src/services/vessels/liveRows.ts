import type { AlertEvent, VesselScheduleItem } from "@gwct/shared";
import { formatKst } from "../../lib/time.js";

export type VesselScheduleRowColor = "yellow" | "cyan" | "green" | "unknown";

interface LatestEtaChange {
  eventId: string;
  occurredAt: string;
  previousEta: string;
  currentEta: string;
  previousEtaDisplay: string;
  currentEtaDisplay: string;
  deltaMinutes: number;
  direction: "earlier" | "later";
  crossedDate: boolean;
  humanMessage: string;
}

export interface VesselLiveRow {
  vesselKey: string;
  vesselName: string;
  voyage: string | null;
  berth: string | null;
  shippingLine: string | null;
  eta: string | null;
  etd: string | null;
  etaDisplay: string | null;
  etdDisplay: string | null;
  status: string | null;
  watchIndex: number | null;
  rowColor: VesselScheduleRowColor;
  latestEtaChange: LatestEtaChange | null;
}

function formatScheduleDisplay(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (normalized) {
    return `${normalized[1]}/${normalized[2]}/${normalized[3]} ${normalized[4]}:${normalized[5]}`;
  }
  return formatKst(value).replace(/-/g, "/").slice(0, 16);
}

function readWatchIndex(item: VesselScheduleItem): number | null {
  const raw = item.rawLabelMap?._watchIndex;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function readRowColor(item: VesselScheduleItem): VesselScheduleRowColor {
  const raw = item.rawLabelMap?._rowColor;
  if (raw === "yellow" || raw === "cyan" || raw === "green") {
    return raw;
  }
  return "unknown";
}

function buildLatestEtaChangeMap(alerts: AlertEvent[]): Map<string, LatestEtaChange> {
  const map = new Map<string, LatestEtaChange>();

  for (const alert of alerts) {
    if (alert.type !== "gwct_eta_changed") {
      continue;
    }

    const payload = (alert.payload || {}) as Record<string, unknown>;
    const vesselKey = typeof payload.vesselKey === "string" ? payload.vesselKey : null;
    if (!vesselKey || map.has(vesselKey)) {
      continue;
    }

    const previousEta = typeof payload.previousEta === "string" ? payload.previousEta : null;
    const currentEta = typeof payload.currentEta === "string" ? payload.currentEta : null;
    const deltaMinutes = typeof payload.deltaMinutes === "number" ? payload.deltaMinutes : null;
    const direction =
      payload.direction === "earlier" || payload.direction === "later" ? payload.direction : null;
    const crossedDate = typeof payload.crossedDate === "boolean" ? payload.crossedDate : false;
    const humanMessage = typeof payload.humanMessage === "string" ? payload.humanMessage : null;

    if (!previousEta || !currentEta || deltaMinutes === null || !direction || !humanMessage) {
      continue;
    }

    map.set(vesselKey, {
      eventId: alert.id,
      occurredAt: alert.occurredAt,
      previousEta,
      currentEta,
      previousEtaDisplay: formatScheduleDisplay(previousEta) || previousEta,
      currentEtaDisplay: formatScheduleDisplay(currentEta) || currentEta,
      deltaMinutes,
      direction,
      crossedDate,
      humanMessage,
    });
  }

  return map;
}

export function buildVesselLiveRows(rows: VesselScheduleItem[], alerts: AlertEvent[]): VesselLiveRow[] {
  const latestEtaChangeByVessel = buildLatestEtaChangeMap(alerts);

  return [...rows]
    .sort((left, right) => {
      const leftIndex = readWatchIndex(left) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = readWatchIndex(right) ?? Number.MAX_SAFE_INTEGER;
      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }
      return left.vesselKey.localeCompare(right.vesselKey);
    })
    .slice(0, 11)
    .map((row) => ({
      vesselKey: row.vesselKey,
      vesselName: row.vesselName,
      voyage: row.terminalVoyage,
      berth: row.berth,
      shippingLine: row.shippingLine,
      eta: row.eta,
      etd: row.etd,
      etaDisplay: formatScheduleDisplay(row.eta),
      etdDisplay: formatScheduleDisplay(row.etd),
      status: row.status,
      watchIndex: readWatchIndex(row),
      rowColor: readRowColor(row),
      latestEtaChange: latestEtaChangeByVessel.get(row.vesselKey) || null,
    }));
}
