import { describe, expect, it } from "vitest";
import type { CraneStatus, YTCountSnapshot } from "@gwct/shared";
import {
  detectCraneThresholdCrossings,
  detectGcProgressReachedEvents,
  detectGcRemainingLowEvents,
  detectGcTotalProgressReachedEvents,
  diffYtThreshold,
} from "../src/engine/diff.js";
import { buildGcProgressSnapshot } from "../src/services/gc/progressSnapshot.js";
import type { GcRemainingMonitorRule, ProgressPercentMonitorRule } from "../src/services/monitorConfig/store.js";

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

const gcProgressThresholds: Record<string, ProgressPercentMonitorRule> = {
  "185": {
    enabled: true,
    thresholdPercent: 80,
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

  it("emits GC progress alerts only when grouped crane progress crosses the configured percent", () => {
    const beforeRows: CraneStatus[] = [
      {
        source: "gwct_gc_remaining",
        craneId: "GC185",
        vesselName: "MV TEST",
        dischargeDone: 30,
        loadDone: 40,
        dischargeRemaining: 5,
        loadRemaining: 15,
        totalRemaining: 20,
        progressPercent: null,
        signature: "before",
        seenAt: "2026-03-13T01:00:00.000Z",
      },
    ];
    const afterRows: CraneStatus[] = [
      {
        source: "gwct_gc_remaining",
        craneId: "GC185",
        vesselName: "MV TEST",
        dischargeDone: 35,
        loadDone: 45,
        dischargeRemaining: 3,
        loadRemaining: 7,
        totalRemaining: 10,
        progressPercent: null,
        signature: "after",
        seenAt: "2026-03-13T01:02:00.000Z",
      },
    ];

    const before = buildGcProgressSnapshot(beforeRows);
    const after = buildGcProgressSnapshot(afterRows);
    const events = detectGcProgressReachedEvents(
      before.items,
      after.items,
      gcProgressThresholds,
      "gwct_gc_remaining",
      "2026-03-13T01:02:00.000Z",
      { sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=F&s=A" },
    );

    expect(before.items[0]?.progressPercent).toBe(77);
    expect(after.items[0]?.progressPercent).toBe(88);
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("gc_progress_reached");
    expect(events[0]?.payload.currentPercent).toBeCloseTo(88.888, 2);
  });

  it("supports decimal thresholds in the final 1% range", () => {
    const events = detectGcTotalProgressReachedEvents(
      99.4,
      99.6,
      {
        enabled: true,
        thresholdPercent: 99.5,
      },
      "gwct_gc_remaining",
      "2026-03-13T01:02:00.000Z",
      { sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=F&s=A" },
    );

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("gc_total_progress_reached");
    expect(events[0]?.beforeValue).toBe("99.4%");
    expect(events[0]?.afterValue).toBe("99.6%");
  });

  it("emits total progress alert only when overall progress crosses the configured percent", () => {
    const rule: ProgressPercentMonitorRule = {
      enabled: true,
      thresholdPercent: 70,
    };

    const events = detectGcTotalProgressReachedEvents(
      69,
      70,
      rule,
      "gwct_gc_remaining",
      "2026-03-13T01:02:00.000Z",
      { sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=F&s=A" },
    );

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("gc_total_progress_reached");
    expect(events[0]?.afterValue).toBe("70%");
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
