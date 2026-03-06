import { formatDashboardMetric } from "@gwct/shared";
import type { EquipmentLoginStatus } from "@gwct/shared";
import { describe, expect, it } from "vitest";
import {
  countSupportEquipmentLogins,
  countTrackedVessels,
  countWorkingGcCranes,
  isValidEquipmentLoginTime,
  isWorkingGcRemainingItem,
} from "../src/services/dashboard/summary.js";
import type { EquipmentFocusSnapshot } from "../src/services/equipment/latestStore.js";
import type { GcRemainingSnapshot } from "../src/services/gc/latestStore.js";
import type { ScheduleFocusSnapshot } from "../src/services/scheduleFocus/latestStore.js";

function equipmentRow(
  equipmentId: string,
  operatorName: string | null,
  loginText: string | null,
): EquipmentLoginStatus {
  return {
    source: "gwct_equipment_status",
    equipmentId,
    operatorName,
    helperName: null,
    loginText,
    stopReason: null,
    signature: `${equipmentId}:${operatorName || "-"}:${loginText || "-"}`,
    seenAt: "2026-03-04T04:00:00.000Z",
  };
}

describe("dashboard summary aggregator", () => {
  it("counts tracked vessels as min(trackingCount, watch window length)", () => {
    const scheduleSnapshot: ScheduleFocusSnapshot = {
      source: "gwct_schedule_list",
      sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=H&s=A",
      capturedAt: "2026-03-04T04:00:00.000Z",
      startReason: "first_yellow",
      items: [
        {
          indexInWatchWindow: 1,
          voyage: "V1",
          vesselName: "A",
          eta: null,
          etaNormalized: "2026-03-04T10:00",
          rowColor: "yellow",
          rowClass: "bg_on",
        },
        {
          indexInWatchWindow: 2,
          voyage: "V2",
          vesselName: "B",
          eta: null,
          etaNormalized: "2026-03-04T11:00",
          rowColor: "yellow",
          rowClass: "bg_on",
        },
      ],
    };

    expect(countTrackedVessels(11, scheduleSnapshot)).toBe(2);
    expect(countTrackedVessels(1, scheduleSnapshot)).toBe(1);
    expect(countTrackedVessels(0, scheduleSnapshot)).toBe(0);
  });

  it("counts only actively staffed GC181~GC190 cranes as working", () => {
    const gcSnapshot: GcRemainingSnapshot = {
      source: "gwct_gc_remaining",
      sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=F&s=A",
      capturedAt: "2026-03-04T04:00:00.000Z",
      items: [
        { gc: 181, dischargeRemaining: 3, loadRemaining: 2, remainingSubtotal: 5 },
        { gc: 182, dischargeRemaining: 5, loadRemaining: 1, remainingSubtotal: 6 },
        { gc: 183, dischargeRemaining: 0, loadRemaining: 0, remainingSubtotal: 0 },
        { gc: 184, dischargeRemaining: null, loadRemaining: null, remainingSubtotal: null },
      ],
    };

    const equipmentSnapshot: EquipmentFocusSnapshot = {
      source: "gwct_equipment_status",
      sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=D&s=A",
      capturedAt: "2026-03-04T04:00:00.000Z",
      ytCount: 0,
      ytKnown: 0,
      ytUnits: [],
      gcStates: [
        {
          gcNo: 181,
          equipmentId: "GC181",
          driverName: "Kim",
          hkName: "Lee",
          loginTime: "03-04 12:00",
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

    expect(isWorkingGcRemainingItem(gcSnapshot.items[0]!, equipmentSnapshot)).toBe(true);
    expect(isWorkingGcRemainingItem(gcSnapshot.items[1]!, equipmentSnapshot)).toBe(false);
    expect(isWorkingGcRemainingItem(gcSnapshot.items[2]!, equipmentSnapshot)).toBe(false);
    expect(isWorkingGcRemainingItem(gcSnapshot.items[3]!, equipmentSnapshot)).toBe(false);
    expect(countWorkingGcCranes(gcSnapshot, equipmentSnapshot)).toBe(1);
  });

  it("counts support equipment login only for LEASE/REPAIR/RS/TC/TH with valid driver+loginTime", () => {
    const rows: EquipmentLoginStatus[] = [
      equipmentRow("GC181", "Kim", "03-04 12:00"),
      equipmentRow("LEASE01", "Lee", "03-04 12:10"),
      equipmentRow("REPAIR-2", "Park", "12:30"),
      equipmentRow("RS03", "Choi", "N/A"),
      equipmentRow("TC05", null, "03-04 12:40"),
      equipmentRow("TH07", "Shin", "03-04 13:10"),
      equipmentRow("YT501", "Han", "03-04 13:00"),
      equipmentRow("TC06", "Jung", "logout"),
    ];

    expect(isValidEquipmentLoginTime("03-04 12:10")).toBe(true);
    expect(isValidEquipmentLoginTime("12:30")).toBe(true);
    expect(isValidEquipmentLoginTime("N/A")).toBe(false);
    expect(isValidEquipmentLoginTime("logout")).toBe(false);
    expect(countSupportEquipmentLogins(rows)).toBe(3);
  });
});

describe("dashboard metric formatter", () => {
  it("formats metric with explicit separator and numeric normalization", () => {
    expect(formatDashboardMetric("vessels", 10)).toBe("vessels: 10");
    expect(formatDashboardMetric("cranes", 2000)).toBe("cranes: 2,000");
    expect(formatDashboardMetric("equipment", Number.NaN)).toBe("equipment: 0");
  });
});
