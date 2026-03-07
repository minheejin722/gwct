import type { CraneStatus } from "@gwct/shared";
import { describe, expect, it } from "vitest";
import type { EquipmentFocusSnapshot } from "../src/services/equipment/latestStore.js";
import type { GcAssignmentState } from "../src/services/gc/assignmentStore.js";
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

function gcSnapshot(...items: GcRemainingSnapshot["items"]): GcRemainingSnapshot {
  return {
    source: "gwct_gc_remaining",
    sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=F&s=A",
    capturedAt: "2026-03-06T04:00:00.000Z",
    items,
  };
}

function equipmentSnapshot(...gcStates: EquipmentFocusSnapshot["gcStates"]): EquipmentFocusSnapshot {
  return {
    source: "gwct_equipment_status",
    sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=D&s=A",
    capturedAt: "2026-03-06T04:00:30.000Z",
    ytCount: 0,
    ytKnown: 0,
    ytUnits: [],
    gcStates,
  };
}

function assignmentState(
  overrides: Array<Partial<GcAssignmentState["items"][string]> & { gc: number }>,
): GcAssignmentState {
  const items: GcAssignmentState["items"] = {};
  for (let gc = 181; gc <= 190; gc += 1) {
    items[String(gc)] = {
      gc,
      activeVesselName: null,
      pendingVesselNames: [],
      lastEvidenceAt: null,
      lastSeenAt: null,
    };
  }
  for (const override of overrides) {
    items[String(override.gc)] = {
      ...items[String(override.gc)],
      ...override,
      gc: override.gc,
      pendingVesselNames: override.pendingVesselNames || [],
    };
  }
  return {
    version: 1,
    items,
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
    const rows = buildGcCraneLiveRows(
      gcSnapshot(
        { gc: 181, dischargeRemaining: 7, loadRemaining: 3, remainingSubtotal: 10 },
        { gc: 182, dischargeRemaining: 4, loadRemaining: 1, remainingSubtotal: 5 },
        { gc: 183, dischargeRemaining: 0, loadRemaining: 0, remainingSubtotal: 0 },
      ),
      equipmentSnapshot(
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
      ),
      [
        craneRow("GC181", "MSC TINA", 7, 3, 10),
        craneRow("GC182", "MSC TINA", 4, 1, 5),
        craneRow("GC183", null, 0, 0, 0),
      ],
    );

    expect(rows).toHaveLength(10);
    expect(rows.find((row) => row.craneId === "GC181")?.workState).toBe("active");
    expect(rows.find((row) => row.craneId === "GC182")?.workState).toBe("scheduled");
    expect(rows.find((row) => row.craneId === "GC183")?.workState).toBe("idle");
    expect(rows.find((row) => row.craneId === "GC182")?.vesselName).toBe("MSC TINA");
  });

  it("shows unresolved multi-vessel rows as checking before evidence exists", () => {
    const rows = buildGcCraneLiveRows(
      gcSnapshot({ gc: 185, dischargeRemaining: 11, loadRemaining: 8, remainingSubtotal: 19 }),
      equipmentSnapshot({
        gcNo: 185,
        equipmentId: "GC185",
        driverName: "Kim",
        hkName: "Lee",
        loginTime: "03-07 09:00",
        stopReason: null,
      }),
      [
        craneRow("GC185", "VESSEL-A", 5, 3, 8),
        craneRow("GC185", "VESSEL-B", 6, 5, 11),
      ],
    );

    const gc185Rows = rows.filter((row) => row.craneId === "GC185");

    expect(gc185Rows).toHaveLength(2);
    expect(gc185Rows.every((row) => row.workState === "checking")).toBe(true);
  });

  it("marks only the assigned vessel as active when evidence exists", () => {
    const rows = buildGcCraneLiveRows(
      gcSnapshot({ gc: 184, dischargeRemaining: 171, loadRemaining: 175, remainingSubtotal: 346 }),
      equipmentSnapshot({
        gcNo: 184,
        equipmentId: "GC184",
        driverName: "Kim",
        hkName: "Lee",
        loginTime: "03-07 15:00",
        stopReason: null,
      }),
      [
        craneRow("GC184", "MAERSK SALTORO", 115, 64, 179),
        craneRow("GC184", "CMA CGM CORTE REAL", 56, 111, 167),
      ],
      assignmentState([
        {
          gc: 184,
          activeVesselName: "MAERSK SALTORO",
          pendingVesselNames: ["CMA CGM CORTE REAL"],
          lastEvidenceAt: "2026-03-07T06:40:10.743Z",
          lastSeenAt: "2026-03-07T06:40:10.743Z",
        },
      ]),
    );

    expect(
      rows.find((row) => row.craneId === "GC184" && row.vesselName === "MAERSK SALTORO")?.workState,
    ).toBe("active");
    expect(
      rows.find((row) => row.craneId === "GC184" && row.vesselName === "CMA CGM CORTE REAL")?.workState,
    ).toBe("scheduled");
  });

  it("keeps sole pending vessel as scheduled until its own decrease is observed", () => {
    const rows = buildGcCraneLiveRows(
      gcSnapshot({ gc: 184, dischargeRemaining: 56, loadRemaining: 111, remainingSubtotal: 167 }),
      equipmentSnapshot({
        gcNo: 184,
        equipmentId: "GC184",
        driverName: "Kim",
        hkName: "Lee",
        loginTime: "03-07 15:20",
        stopReason: null,
      }),
      [craneRow("GC184", "CMA CGM CORTE REAL", 56, 111, 167)],
      assignmentState([
        {
          gc: 184,
          activeVesselName: null,
          pendingVesselNames: ["CMA CGM CORTE REAL"],
          lastEvidenceAt: "2026-03-07T06:40:10.743Z",
          lastSeenAt: "2026-03-07T06:41:10.743Z",
        },
      ]),
    );

    expect(
      rows.find((row) => row.craneId === "GC184" && row.vesselName === "CMA CGM CORTE REAL")?.workState,
    ).toBe("scheduled");
  });

  it("never marks a row active when crew is not assigned", () => {
    const rows = buildGcCraneLiveRows(
      gcSnapshot({ gc: 184, dischargeRemaining: 171, loadRemaining: 175, remainingSubtotal: 346 }),
      equipmentSnapshot({
        gcNo: 184,
        equipmentId: "GC184",
        driverName: null,
        hkName: null,
        loginTime: null,
        stopReason: null,
      }),
      [
        craneRow("GC184", "MAERSK SALTORO", 115, 64, 179),
        craneRow("GC184", "CMA CGM CORTE REAL", 56, 111, 167),
      ],
      assignmentState([
        {
          gc: 184,
          activeVesselName: "MAERSK SALTORO",
          pendingVesselNames: ["CMA CGM CORTE REAL"],
          lastEvidenceAt: "2026-03-07T06:40:10.743Z",
          lastSeenAt: "2026-03-07T06:40:10.743Z",
        },
      ]),
    );

    expect(rows.every((row) => row.workState === "scheduled" || row.craneId !== "GC184")).toBe(true);
  });
});
