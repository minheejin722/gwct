import { describe, expect, it } from "vitest";
import type { EquipmentLoginStatus } from "@gwct/shared";
import { detectYtCountStateEvents, detectYtUnitStatusEvents } from "../src/engine/diff.js";
import type { EquipmentYtMonitorConfig } from "../src/services/monitorConfig/store.js";

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
