import { describe, expect, it } from "vitest";
import type { CraneStatus } from "@gwct/shared";
import { normalizeCraneLiveRows } from "../src/services/gc/liveRows.js";

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
    signature: `${craneId}_${vesselName}_${dischargeRemaining}_${loadRemaining}_${totalRemaining}`,
    seenAt: "2026-03-04T00:00:00.000Z",
  };
}

describe("normalizeCraneLiveRows", () => {
  it("keeps one row per crane and prefers the most informative row", () => {
    const rows: CraneStatus[] = [
      craneRow("GC181", "HANSA AFRICA", null, null, null),
      craneRow("GC181", "MSC TINA", 141, 361, 502),
      craneRow("GC181", "ANOTHER", 141, null, 141),
      craneRow("GC182", "MSC TINA", 361, 114, 475),
    ];

    const normalized = normalizeCraneLiveRows(rows);

    expect(normalized).toHaveLength(2);
    const gc181 = normalized.find((item) => item.craneId === "GC181");
    expect(gc181?.vesselName).toBe("MSC TINA");
    expect(gc181?.totalRemaining).toBe(502);
  });

  it("sorts by crane number and keeps first row when score ties", () => {
    const rows: CraneStatus[] = [
      craneRow("GC190", "VESSEL-A", 5, 6, 11),
      craneRow("GC181", "VESSEL-B", 1, 2, 3),
      craneRow("GC181", "VESSEL-C", 1, 2, 3),
      craneRow("GC189", "VESSEL-D", 7, 8, 15),
    ];

    const normalized = normalizeCraneLiveRows(rows);

    expect(normalized.map((item) => item.craneId)).toEqual(["GC181", "GC189", "GC190"]);
    expect(normalized[0]?.vesselName).toBe("VESSEL-B");
  });
});
