import { describe, expect, it } from "vitest";
import type { EquipmentLoginStatus, YTCountSnapshot } from "@gwct/shared";
import { detectGcEquipmentFocusEvents, detectYtCountStateEvents } from "../src/engine/diff.js";
import { parseGwctEquipmentStatus } from "../src/parsers/gwct.js";
import type { EquipmentYtMonitorConfig } from "../src/services/monitorConfig/store.js";

function equipmentRow(
  equipmentId: string,
  operatorName: string | null,
  helperName: string | null,
  loginText: string | null,
  stopReason: string | null,
): EquipmentLoginStatus {
  return {
    source: "gwct_equipment_status",
    equipmentId,
    operatorName,
    helperName,
    loginText,
    stopReason,
    signature: `${equipmentId}:${operatorName || "-"}:${helperName || "-"}`,
    seenAt: "2026-03-01T12:00:00.000Z",
  };
}

function ytSnapshot(totalLoggedIn: number): YTCountSnapshot {
  return {
    source: "gwct_equipment_status",
    totalLoggedIn,
    totalKnown: 60,
    threshold: null,
    signature: `yt:${totalLoggedIn}`,
    seenAt: "2026-03-01T12:00:00.000Z",
  };
}

describe("equipment focus parser and event rules", () => {
  it("counts YT logged-in by non-empty driver and parses GC driver/HK lines", () => {
    const html = `<html><body>
    <table class="AA_list">
      <tr><th>장비</th><th>기사</th><th>로그인</th><th>중단사유</th></tr>
      <tr><td>GC188</td><td>홍길동<br>HK김철수</td><td>03-01 20:15</td><td>장비점검</td></tr>
      <tr><td>YT01</td><td>김기사</td><td></td><td></td></tr>
      <tr><td>YT02</td><td>-</td><td></td><td></td></tr>
      <tr><td>YT03</td><td>N/A</td><td></td><td></td></tr>
      <tr><td>YT04</td><td></td><td></td><td></td></tr>
      <tr><td>YT05</td><td>박기사</td><td></td><td></td></tr>
    </table>
    </body></html>`;

    const bundle = parseGwctEquipmentStatus(html, "2026-03-01T12:00:00.000Z", "gwct_equipment_status");
    const gc188 = bundle.equipment.find((row) => row.equipmentId === "GC188");

    expect(gc188?.operatorName).toBe("홍길동");
    expect(gc188?.helperName).toBe("HK김철수");
    expect(gc188?.stopReason).toBe("장비점검");

    expect(bundle.yt?.totalKnown).toBe(5);
    expect(bundle.yt?.totalLoggedIn).toBe(2);
  });

  it("applies YT threshold state transitions with baseline-first behavior", () => {
    const baseConfig: EquipmentYtMonitorConfig = {
      enabled: true,
      threshold: 25,
      stateInitialized: false,
      state: null,
    };

    const baseline = detectYtCountStateEvents(
      ytSnapshot(24),
      baseConfig,
      "gwct_equipment_status",
      "2026-03-01T12:00:00.000Z",
      { sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=D&s=A" },
    );
    expect(baseline.events).toHaveLength(0);
    expect(baseline.initialized).toBe(true);
    expect(baseline.nextState).toBe("LOW");

    const stayLow = detectYtCountStateEvents(
      ytSnapshot(24),
      { ...baseConfig, stateInitialized: true, state: "LOW" },
      "gwct_equipment_status",
      "2026-03-01T12:01:00.000Z",
      { sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=D&s=A", previousCount: 24 },
    );
    expect(stayLow.events).toHaveLength(0);
    expect(stayLow.nextState).toBe("LOW");

    const recovered = detectYtCountStateEvents(
      ytSnapshot(25),
      { ...baseConfig, stateInitialized: true, state: "LOW" },
      "gwct_equipment_status",
      "2026-03-01T12:02:00.000Z",
      { sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=D&s=A", previousCount: 24 },
    );
    expect(recovered.events).toHaveLength(1);
    expect(recovered.events[0]?.type).toBe("yt_count_recovered");
    expect(recovered.nextState).toBe("NORMAL");

    const goLow = detectYtCountStateEvents(
      ytSnapshot(24),
      { ...baseConfig, stateInitialized: true, state: "NORMAL" },
      "gwct_equipment_status",
      "2026-03-01T12:03:00.000Z",
      { sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=D&s=A", previousCount: 25 },
    );
    expect(goLow.events).toHaveLength(1);
    expect(goLow.events[0]?.type).toBe("yt_count_low");
    expect(goLow.nextState).toBe("LOW");
  });

  it("emits GC180~190 focus events only for real changes", () => {
    const prev = [equipmentRow("G/C 188", null, null, null, null)];
    const curr = [equipmentRow("GC-188", "홍길동", "HK김철수", "03-01 20:15", "장비점검")];
    const next = [equipmentRow("GC188", "이몽룡", "HK박문수", "03-01 20:25", null)];

    const firstEvents = detectGcEquipmentFocusEvents(
      prev,
      curr,
      "gwct_equipment_status",
      "2026-03-01T12:10:00.000Z",
      { sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=D&s=A" },
    );
    const firstTypes = firstEvents.map((event) => event.type);
    expect(firstTypes).toContain("gc_driver_login");
    expect(firstTypes).toContain("gc_hk_login");
    expect(firstTypes).toContain("gc_stop_reason_set");
    expect(firstTypes).toContain("gc_login_time_changed");

    const secondEvents = detectGcEquipmentFocusEvents(
      curr,
      next,
      "gwct_equipment_status",
      "2026-03-01T12:11:00.000Z",
      { sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=D&s=A" },
    );
    const secondTypes = secondEvents.map((event) => event.type);
    expect(secondTypes).toContain("gc_driver_changed");
    expect(secondTypes).toContain("gc_hk_changed");
    expect(secondTypes).toContain("gc_stop_reason_cleared");
    expect(secondTypes).toContain("gc_login_time_changed");
  });
});
