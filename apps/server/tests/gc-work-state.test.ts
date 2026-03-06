import type { CraneStatus } from "@gwct/shared";
import { describe, expect, it } from "vitest";
import type { EquipmentFocusSnapshot } from "../src/services/equipment/latestStore.js";
import type { GcRemainingSnapshot } from "../src/services/gc/latestStore.js";
import { buildGcCraneLiveRows, deriveGcWorkState } from "../src/services/gc/workState.js";

function craneRow(
  craneId: string,
  vesselName: string | null,
  dischargeRemaining: number | null,
  loadRemaining: number | null,
  totalRemaining: number | null,
): CraneStatus {
  return {
    source: "gwct_work_status",
    craneId,
    vesselName,
    dischargeDone: null,
    loadDone: null,
    dischargeRemaining,
    loadRemaining,
    totalRemaining,
    progressPercent: null,
    signature: `${craneId}:${vesselName || "-"}:${totalRemaining ?? "-"}`,
    seenAt: "2026-03-06T04:00:00.000Z",
  };
}

describe("gc work state", () => {
  it("classifies remaining work without crew as scheduled", () => {
    expect(
      deriveGcWorkState(12, {
        gcNo: 181,
        equipmentId: "GC181",
        driverName: null,
        hkName: null,
        loginTime: null,
        stopReason: null,
      }),
    ).toBe("scheduled");
  });

  it("builds GC181~190 live rows with active, scheduled, and idle states", () => {
    const gcSnapshot: GcRemainingSnapshot = {
      source: "gwct_gc_remaining",
      sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=F&s=A",
      capturedAt: "2026-03-06T04:00:00.000Z",
      items: [
        { gc: 181, dischargeRemaining: 7, loadRemaining: 3, remainingSubtotal: 10 },
        { gc: 182, dischargeRemaining: 4, loadRemaining: 1, remainingSubtotal: 5 },
        { gc: 183, dischargeRemaining: 0, loadRemaining: 0, remainingSubtotal: 0 },
      ],
    };

    const equipmentSnapshot: EquipmentFocusSnapshot = {
      source: "gwct_equipment_status",
      sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=D&s=A",
      capturedAt: "2026-03-06T04:00:30.000Z",
      ytCount: 0,
      ytKnown: 0,
      ytUnits: [],
      gcStates: [
        {
          gcNo: 181,
          equipmentId: "GC181",
          driverName: "Kim",
          hkName: "Lee",
          loginTime: "03-06 12:00",
          stopReason: null,
        },
        {
          gcNo: 182,
          equipmentId: "GC182",
          driverName: null,
          hkName: null,
          loginTime: null,
          stopReason: null,
        },
      ],
    };

    const rows = buildGcCraneLiveRows(gcSnapshot, equipmentSnapshot, [
      craneRow("GC181", "MSC TINA", 7, 3, 10),
      craneRow("GC182", "MSC TINA", 4, 1, 5),
      craneRow("GC183", null, 0, 0, 0),
    ]);

    expect(rows).toHaveLength(10);
    expect(rows.find((row) => row.craneId === "GC181")?.workState).toBe("active");
    expect(rows.find((row) => row.craneId === "GC182")?.workState).toBe("scheduled");
    expect(rows.find((row) => row.craneId === "GC183")?.workState).toBe("idle");
    expect(rows.find((row) => row.craneId === "GC182")?.vesselName).toBe("MSC TINA");
  });
});
