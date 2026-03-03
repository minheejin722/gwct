import { describe, expect, it } from "vitest";
import type { CraneStatus, YTCountSnapshot } from "@gwct/shared";
import { detectCraneThresholdCrossings, detectGcRemainingLowEvents, diffYtThreshold } from "../src/engine/diff.js";
import type { GcRemainingMonitorRule } from "../src/services/monitorConfig/store.js";

function crane(craneId: string, totalRemaining: number): CraneStatus {
  return {
    source: "gwct_work_status",
    craneId,
    vesselName: "TEST",
    dischargeDone: null,
    loadDone: null,
    dischargeRemaining: null,
    loadRemaining: null,
    totalRemaining,
    progressPercent: null,
    signature: `${craneId}_${totalRemaining}`,
    seenAt: new Date().toISOString(),
  };
}

function gcCrane(craneId: string, dischargeRemaining: number | null, loadRemaining: number | null): CraneStatus {
  return {
    source: "gwct_gc_remaining",
    craneId,
    vesselName: null,
    dischargeDone: null,
    loadDone: null,
    dischargeRemaining,
    loadRemaining,
    totalRemaining:
      dischargeRemaining !== null || loadRemaining !== null
        ? (dischargeRemaining ?? 0) + (loadRemaining ?? 0)
        : null,
    progressPercent: null,
    signature: `${craneId}_${dischargeRemaining}_${loadRemaining}`,
    seenAt: new Date().toISOString(),
  };
}

const gcThresholds: Record<string, GcRemainingMonitorRule> = {
  "188": {
    enabled: true,
    threshold: 10,
  },
};

describe("threshold logic", () => {
  it("emits crane threshold only on crossing", () => {
    const prev = [crane("GC181", 110)];
    const curr = [crane("GC181", 90)];
    const events = detectCraneThresholdCrossings(
      prev,
      curr,
      new Map([["GC181", 100]]),
      "gwct_work_status",
      new Date().toISOString(),
    );

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("CRANE_THRESHOLD");
  });

  it("emits GC remaining low only on downward crossing for enabled GC subtotal", () => {
    const prev = [gcCrane("GC188", 11, 9)];
    const curr = [gcCrane("GC188", 3, 4)];

    const events = detectGcRemainingLowEvents(
      prev,
      curr,
      gcThresholds,
      "gwct_gc_remaining",
      "2026-03-01T12:00:00.000Z",
      { sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=F&s=A" },
    );

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("gc_remaining_low");
    expect(events[0]?.payload.currentSubtotal).toBe(7);
    expect(events[0]?.payload.breakdown).toEqual({
      discharge: 3,
      load: 4,
    });
  });

  it("resets after recovery so next downward crossing emits again", () => {
    const high = [gcCrane("GC188", 11, 9)];
    const low = [gcCrane("GC188", 3, 4)];
    const recovered = [gcCrane("GC188", 12, 8)];

    const firstDrop = detectGcRemainingLowEvents(
      high,
      low,
      gcThresholds,
      "gwct_gc_remaining",
      "2026-03-01T12:01:00.000Z",
      { sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=F&s=A" },
    );
    const stayLow = detectGcRemainingLowEvents(
      low,
      low,
      gcThresholds,
      "gwct_gc_remaining",
      "2026-03-01T12:02:00.000Z",
      { sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=F&s=A" },
    );
    const goUp = detectGcRemainingLowEvents(
      low,
      recovered,
      gcThresholds,
      "gwct_gc_remaining",
      "2026-03-01T12:03:00.000Z",
      { sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=F&s=A" },
    );
    const secondDrop = detectGcRemainingLowEvents(
      recovered,
      low,
      gcThresholds,
      "gwct_gc_remaining",
      "2026-03-01T12:04:00.000Z",
      { sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=F&s=A" },
    );

    expect(firstDrop).toHaveLength(1);
    expect(stayLow).toHaveLength(0);
    expect(goUp).toHaveLength(0);
    expect(secondDrop).toHaveLength(1);
  });

  it("emits YT below threshold crossing", () => {
    const prev: YTCountSnapshot = {
      source: "gwct_equipment_status",
      totalKnown: 80,
      totalLoggedIn: 15,
      threshold: 10,
      signature: "p",
      seenAt: new Date().toISOString(),
    };
    const curr: YTCountSnapshot = {
      ...prev,
      totalLoggedIn: 9,
      signature: "c",
    };

    const events = diffYtThreshold(prev, curr, 10, "gwct_equipment_status", new Date().toISOString());
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("YT_BELOW_THRESHOLD");
  });
});
