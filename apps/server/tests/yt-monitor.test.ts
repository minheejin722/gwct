import { describe, expect, it } from "vitest";
import type { EquipmentLoginStatus } from "@gwct/shared";
import { detectYtCountStateEvents, detectYtUnitStatusEvents } from "../src/engine/diff.js";
import type { EquipmentYtMonitorConfig } from "../src/services/monitorConfig/store.js";
import { buildYtUnitSnapshotFromEquipment } from "../src/services/equipment/ytUnits.js";

function ytRow(
  equipmentId: string,
  operatorName: string | null,
  loginText: string | null,
  stopReason: string | null,
  helperName: string | null = null,
): EquipmentLoginStatus {
  return {
    source: "gwct_equipment_status",
    equipmentId,
    operatorName,
    helperName,
    loginText,
    stopReason,
    signature: `${equipmentId}:${operatorName || "-"}:${loginText || "-"}:${stopReason || "-"}`,
    seenAt: "2026-03-04T04:00:00.000Z",
  };
}

describe("YT monitor rules", () => {
  it("applies count transition rules for 24 -> 23 -> 23 -> 22 -> 25", () => {
    const baseConfig: EquipmentYtMonitorConfig = {
      enabled: true,
      threshold: 25,
      stateInitialized: false,
      state: null,
    };

    const sequence = [24, 23, 23, 22, 25];
    const emittedTypes: string[][] = [];
    let config = baseConfig;
    let previousCount: number | null = null;

    sequence.forEach((currentCount, index) => {
      const result = detectYtCountStateEvents(
        {
          source: "gwct_equipment_status",
          totalLoggedIn: currentCount,
          totalKnown: 30,
          threshold: null,
          signature: `yt-${currentCount}-${index}`,
          seenAt: `2026-03-04T04:0${index}:00.000Z`,
        },
        config,
        "gwct_equipment_status",
        `2026-03-04T04:0${index}:00.000Z`,
        {
          sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=D&s=A",
          previousCount,
        },
      );

      emittedTypes.push(result.events.map((event) => event.type));
      config = {
        ...config,
        stateInitialized: result.initialized,
        state: result.nextState,
      };
      previousCount = currentCount;
    });

    expect(emittedTypes).toEqual([
      [],
      ["yt_count_low"],
      [],
      ["yt_count_low"],
      ["yt_count_recovered"],
    ]);
  });

  it("emits per-unit status events with reason-change support and fingerprint dedupe", () => {
    const active = [ytRow("YT23", "Hong", "03-04 08:00", null)];
    const stoppedA = [ytRow("YT23", "Hong", "03-04 08:00", "Reason A")];
    const stoppedB = [ytRow("YT23", "Hong", "03-04 08:00", "Reason B")];

    const activeToStopped = detectYtUnitStatusEvents(
      active,
      stoppedA,
      "gwct_equipment_status",
      "2026-03-04T04:10:00.000Z",
      { sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=D&s=A" },
    );
    expect(activeToStopped).toHaveLength(1);
    expect(activeToStopped[0]?.type).toBe("yt_unit_status_changed");
    expect(activeToStopped[0]?.payload.transitionKind).toBe("active_to_stopped");

    const sameReason = detectYtUnitStatusEvents(
      stoppedA,
      stoppedA,
      "gwct_equipment_status",
      "2026-03-04T04:11:00.000Z",
      { sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=D&s=A" },
    );
    expect(sameReason).toHaveLength(0);

    const reasonChanged = detectYtUnitStatusEvents(
      stoppedA,
      stoppedB,
      "gwct_equipment_status",
      "2026-03-04T04:12:00.000Z",
      { sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=D&s=A" },
    );
    expect(reasonChanged).toHaveLength(1);
    expect(reasonChanged[0]?.payload.transitionKind).toBe("stopped_reason_changed");

    const stoppedToActive = detectYtUnitStatusEvents(
      stoppedB,
      active,
      "gwct_equipment_status",
      "2026-03-04T04:13:00.000Z",
      { sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=D&s=A" },
    );
    expect(stoppedToActive).toHaveLength(1);
    expect(stoppedToActive[0]?.payload.transitionKind).toBe("stopped_to_active");
  });

  it("handles active -> logged_out -> logged_out -> active transitions", () => {
    const active = [ytRow("YT17", "Kim", "03-04 08:05", null)];
    const loggedOut = [ytRow("YT17", null, null, null)];

    const toLoggedOut = detectYtUnitStatusEvents(
      active,
      loggedOut,
      "gwct_equipment_status",
      "2026-03-04T04:20:00.000Z",
      { sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=D&s=A" },
    );
    expect(toLoggedOut).toHaveLength(1);
    expect(toLoggedOut[0]?.payload.transitionKind).toBe("active_to_logged_out");

    const stillLoggedOut = detectYtUnitStatusEvents(
      loggedOut,
      loggedOut,
      "gwct_equipment_status",
      "2026-03-04T04:21:00.000Z",
      { sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=D&s=A" },
    );
    expect(stillLoggedOut).toHaveLength(0);

    const backActive = detectYtUnitStatusEvents(
      loggedOut,
      active,
      "gwct_equipment_status",
      "2026-03-04T04:22:00.000Z",
      { sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=D&s=A" },
    );
    expect(backActive).toHaveLength(1);
    expect(backActive[0]?.payload.transitionKind).toBe("logged_out_to_active");
  });

  it("uses 다시 로그인 only when the same YT and same driver return after logout", () => {
    const active = [ytRow("YT17", "DYHong", "03-04 08:05", null)];
    const loggedOut = [ytRow("YT17", null, null, null)];
    const prevUnits = buildYtUnitSnapshotFromEquipment(active);
    const loggedOutUnits = buildYtUnitSnapshotFromEquipment(loggedOut, prevUnits, "2026-03-04T04:20:00.000Z");
    const backSameDriverUnits = buildYtUnitSnapshotFromEquipment(
      [ytRow("YT17", "DYHong", "03-04 08:30", null)],
      loggedOutUnits,
      "2026-03-04T04:30:00.000Z",
    );

    const backSameDriver = detectYtUnitStatusEvents(
      loggedOut,
      [ytRow("YT17", "DYHong", "03-04 08:30", null)],
      "gwct_equipment_status",
      "2026-03-04T04:30:00.000Z",
      {
        sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=D&s=A",
        prevUnits: loggedOutUnits,
        currUnits: backSameDriverUnits,
      },
    );

    expect(backSameDriver).toHaveLength(1);
    expect(backSameDriver[0]?.payload.transitionKind).toBe("logged_out_to_active");
    expect(backSameDriver[0]?.message).toBe("YT17 DYHong 다시 로그인");
  });

  it("treats a different same-company driver after logout as 교대, not 다시 로그인", () => {
    const active = [ytRow("YT17", "DYHong", "03-04 08:05", null)];
    const loggedOut = [ytRow("YT17", null, null, null)];
    const prevUnits = buildYtUnitSnapshotFromEquipment(active);
    const loggedOutUnits = buildYtUnitSnapshotFromEquipment(loggedOut, prevUnits, "2026-03-04T04:20:00.000Z");
    const nextUnits = buildYtUnitSnapshotFromEquipment(
      [ytRow("YT17", "DYKim", "03-04 08:30", null)],
      loggedOutUnits,
      "2026-03-04T04:30:00.000Z",
    );

    const changed = detectYtUnitStatusEvents(
      loggedOut,
      [ytRow("YT17", "DYKim", "03-04 08:30", null)],
      "gwct_equipment_status",
      "2026-03-04T04:30:00.000Z",
      {
        sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=D&s=A",
        prevUnits: loggedOutUnits,
        currUnits: nextUnits,
      },
    );

    expect(changed).toHaveLength(1);
    expect(changed[0]?.title).toBe("YT 기사 교대 (YT17)");
    expect(changed[0]?.message).toBe("YT17 DYHong -> DYKim 교대");
    expect(changed[0]?.payload.transitionKind).toBe("driver_changed");
  });

  it("treats a different-company driver after logout as 주야 교대", () => {
    const active = [ytRow("YT17", "DYHong", "03-04 08:05", null)];
    const loggedOut = [ytRow("YT17", null, null, null)];
    const prevUnits = buildYtUnitSnapshotFromEquipment(active);
    const loggedOutUnits = buildYtUnitSnapshotFromEquipment(loggedOut, prevUnits, "2026-03-04T04:20:00.000Z");
    const nextUnits = buildYtUnitSnapshotFromEquipment(
      [ytRow("YT17", "JJKim", "03-04 08:30", null)],
      loggedOutUnits,
      "2026-03-04T04:30:00.000Z",
    );

    const changed = detectYtUnitStatusEvents(
      loggedOut,
      [ytRow("YT17", "JJKim", "03-04 08:30", null)],
      "gwct_equipment_status",
      "2026-03-04T04:30:00.000Z",
      {
        sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=D&s=A",
        prevUnits: loggedOutUnits,
        currUnits: nextUnits,
      },
    );

    expect(changed).toHaveLength(1);
    expect(changed[0]?.title).toBe("YT 주야 교대 (YT17)");
    expect(changed[0]?.message).toBe("YT17 DYHong -> JJKim 주야 교대");
    expect(changed[0]?.payload.transitionKind).toBe("shift_handoff");
  });

  it("falls back to plain 로그인 when the previous driver identity is unavailable", () => {
    const loggedOut = [ytRow("YT17", null, null, null)];
    const nextUnits = buildYtUnitSnapshotFromEquipment(
      [ytRow("YT17", "JJKim", "03-04 08:30", null)],
      [],
      "2026-03-04T04:30:00.000Z",
    );

    const changed = detectYtUnitStatusEvents(
      loggedOut,
      [ytRow("YT17", "JJKim", "03-04 08:30", null)],
      "gwct_equipment_status",
      "2026-03-04T04:30:00.000Z",
      {
        sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=D&s=A",
        currUnits: nextUnits,
      },
    );

    expect(changed).toHaveLength(1);
    expect(changed[0]?.message).toBe("YT17 JJKim 로그인");
    expect(changed[0]?.payload.transitionKind).toBe("logged_out_to_active");
  });

  it("emits a driver replacement event when the same YT stays logged in with a different driver", () => {
    const before = [ytRow("YT23", "DYHong", "03-04 08:00", null)];
    const after = [ytRow("YT23", "DYKim", "03-04 08:00", null)];

    const changed = detectYtUnitStatusEvents(
      before,
      after,
      "gwct_equipment_status",
      "2026-03-04T04:25:00.000Z",
      { sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=D&s=A" },
    );

    expect(changed).toHaveLength(1);
    expect(changed[0]?.type).toBe("yt_unit_status_changed");
    expect(changed[0]?.title).toBe("YT 기사 교대 (YT23)");
    expect(changed[0]?.message).toBe("YT23 DYHong -> DYKim 교대");
    expect(changed[0]?.payload.transitionKind).toBe("driver_changed");
  });

  it("emits 주야 교대 when the same YT changes to a driver with a different company prefix", () => {
    const before = [ytRow("YT23", "DYHong", "03-04 08:00", null)];
    const after = [ytRow("YT23", "JJKim", "03-04 08:00", null)];

    const changed = detectYtUnitStatusEvents(
      before,
      after,
      "gwct_equipment_status",
      "2026-03-04T04:26:00.000Z",
      { sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=D&s=A" },
    );

    expect(changed).toHaveLength(1);
    expect(changed[0]?.title).toBe("YT 주야 교대 (YT23)");
    expect(changed[0]?.message).toBe("YT23 DYHong -> JJKim 주야 교대");
    expect(changed[0]?.payload.transitionKind).toBe("shift_handoff");
  });

  it("treats first baseline and identical fingerprint as no-op", () => {
    const baseline = detectYtUnitStatusEvents(
      [],
      [ytRow("YT99", "Park", "03-04 09:00", null)],
      "gwct_equipment_status",
      "2026-03-04T04:30:00.000Z",
      { sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=D&s=A" },
    );
    expect(baseline).toHaveLength(0);

    const unchanged = detectYtUnitStatusEvents(
      [ytRow("YT99", "Park", "03-04 09:00", null)],
      [ytRow("YT99", "Park", "03-04 09:00", null)],
      "gwct_equipment_status",
      "2026-03-04T04:31:00.000Z",
      { sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=D&s=A" },
    );
    expect(unchanged).toHaveLength(0);
  });
});
