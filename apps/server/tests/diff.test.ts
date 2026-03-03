import { describe, expect, it } from "vitest";
import type { SourceId, VesselScheduleItem } from "@gwct/shared";
import { diffVesselItems } from "../src/engine/diff.js";

function vessel(
  key: string,
  eta: string | null,
  berth = "14",
  status: string | null = null,
  source: SourceId = "gwct_schedule_list",
): VesselScheduleItem {
  return {
    source,
    vesselKey: key,
    vesselName: key,
    terminalVoyage: key,
    berth,
    shippingLine: null,
    route: null,
    eta,
    etb: null,
    ata: null,
    etd: null,
    atd: null,
    status,
    workStartAt: null,
    workEndAt: null,
    importCutoffAt: null,
    rawLabelMap: {},
    signature: key,
    seenAt: new Date().toISOString(),
  };
}

describe("vessel diff", () => {
  it("classifies time pulled forward and delayed", () => {
    const prev = [vessel("A", "2026-03-01T10:00:00.000Z"), vessel("B", "2026-03-01T10:00:00.000Z")];
    const curr = [vessel("A", "2026-03-01T09:30:00.000Z"), vessel("B", "2026-03-01T10:30:00.000Z")];

    const events = diffVesselItems(prev, curr, "gwct_schedule_list", new Date().toISOString());
    const types = events.map((event) => event.type);

    expect(types).toContain("TIME_PULLED_FORWARD");
    expect(types).toContain("TIME_DELAYED");
  });

  it("detects new and removed vessel", () => {
    const prev = [vessel("A", "2026-03-01T10:00:00.000Z")];
    const curr = [vessel("B", "2026-03-01T11:00:00.000Z")];
    const events = diffVesselItems(prev, curr, "gwct_schedule_list", new Date().toISOString());
    const types = events.map((event) => event.type);

    expect(types).toContain("NEW_VESSEL");
    expect(types).toContain("REMOVED_VESSEL");
  });
});
