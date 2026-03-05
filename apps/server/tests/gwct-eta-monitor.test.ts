import { describe, expect, it } from "vitest";
import type { VesselScheduleItem } from "@gwct/shared";
import { detectGwctEtaChangedEvents } from "../src/engine/diff.js";

function vessel(vesselKey: string, etaNormalized: string | null): VesselScheduleItem {
  return {
    source: "gwct_schedule_list",
    vesselKey,
    vesselName: vesselKey,
    terminalVoyage: vesselKey,
    berth: "14",
    shippingLine: null,
    route: null,
    eta: null,
    etb: null,
    ata: null,
    etd: null,
    atd: null,
    status: null,
    workStartAt: null,
    workEndAt: null,
    importCutoffAt: null,
    rawLabelMap: {
      _watchIndex: "1",
      _etaNormalized: etaNormalized || "",
    },
    signature: `${vesselKey}:${etaNormalized || "none"}`,
    seenAt: "2026-03-04T04:00:00.000Z",
  };
}

describe("gwct eta monitor payload and message rules", () => {
  it("handles same-day earlier/later with delta and direction", () => {
    const laterEvents = detectGwctEtaChangedEvents(
      [vessel("VOY1", "2026-03-04T10:00")],
      [vessel("VOY1", "2026-03-04T11:45")],
      "gwct_schedule_list",
      "2026-03-04T04:10:00.000Z",
      { sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=H&s=A" },
    );
    expect(laterEvents).toHaveLength(1);
    expect(laterEvents[0]?.payload.direction).toBe("later");
    expect(laterEvents[0]?.payload.deltaMinutes).toBe(105);
    expect(laterEvents[0]?.payload.crossedDate).toBe(false);
    expect(String(laterEvents[0]?.payload.humanMessage || "")).toContain("1시간 45분");

    const earlierEvents = detectGwctEtaChangedEvents(
      [vessel("VOY2", "2026-03-04T10:00")],
      [vessel("VOY2", "2026-03-04T09:30")],
      "gwct_schedule_list",
      "2026-03-04T04:11:00.000Z",
      { sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=H&s=A" },
    );
    expect(earlierEvents).toHaveLength(1);
    expect(earlierEvents[0]?.payload.direction).toBe("earlier");
    expect(earlierEvents[0]?.payload.deltaMinutes).toBe(-30);
    expect(earlierEvents[0]?.payload.crossedDate).toBe(false);
    expect(String(earlierEvents[0]?.payload.humanMessage || "")).toContain("0시간 30분");
  });

  it("handles next-day rollover message", () => {
    const events = detectGwctEtaChangedEvents(
      [vessel("VOY3", "2026-03-04T23:30")],
      [vessel("VOY3", "2026-03-05T00:20")],
      "gwct_schedule_list",
      "2026-03-04T04:12:00.000Z",
      { sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=H&s=A" },
    );

    expect(events).toHaveLength(1);
    expect(events[0]?.payload.direction).toBe("later");
    expect(events[0]?.payload.crossedDate).toBe(true);
    expect(String(events[0]?.payload.humanMessage || "")).toContain("내일");
  });

  it("skips event when previous ETA is missing", () => {
    const events = detectGwctEtaChangedEvents(
      [vessel("VOY4", null)],
      [vessel("VOY4", "2026-03-04T18:00")],
      "gwct_schedule_list",
      "2026-03-04T04:13:00.000Z",
      { sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=H&s=A" },
    );
    expect(events).toHaveLength(0);
  });

  it("skips event when normalized ETA is identical", () => {
    const events = detectGwctEtaChangedEvents(
      [vessel("VOY5", "2026-03-04T13:30")],
      [vessel("VOY5", "2026-03-04T13:30")],
      "gwct_schedule_list",
      "2026-03-04T04:14:00.000Z",
      { sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=H&s=A" },
    );
    expect(events).toHaveLength(0);
  });
});
