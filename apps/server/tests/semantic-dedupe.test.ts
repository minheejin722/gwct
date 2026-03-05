import { describe, expect, it } from "vitest";
import type {
  CraneStatus,
  EquipmentLoginStatus,
  VesselScheduleItem,
  WeatherNoticeSnapshot,
  YTCountSnapshot,
} from "@gwct/shared";
import {
  detectGcEquipmentFocusEvents,
  detectGcRemainingLowEvents,
  detectGwctEtaChangedEvents,
  detectYtCountStateEvents,
  diffWeather,
} from "../src/engine/diff.js";

function vessel(vesselKey: string, eta: string): VesselScheduleItem {
  return {
    source: "gwct_schedule_list",
    vesselKey,
    vesselName: vesselKey,
    terminalVoyage: vesselKey,
    berth: "14",
    shippingLine: null,
    route: null,
    eta,
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
      _etaNormalized: "2026-03-04T13:30",
    },
    signature: `${vesselKey}:${eta}`,
    seenAt: "2026-03-04T04:00:00.000Z",
  };
}

function gcRemaining(craneId: string, dischargeRemaining: number, loadRemaining: number): CraneStatus {
  return {
    source: "gwct_gc_remaining",
    craneId,
    vesselName: null,
    dischargeDone: null,
    loadDone: null,
    dischargeRemaining,
    loadRemaining,
    totalRemaining: dischargeRemaining + loadRemaining,
    progressPercent: null,
    signature: `${craneId}:${dischargeRemaining}:${loadRemaining}`,
    seenAt: "2026-03-04T04:00:00.000Z",
  };
}

function equipment(
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
    signature: `${equipmentId}:${operatorName || "-"}:${helperName || "-"}:${loginText || "-"}:${stopReason || "-"}`,
    seenAt: "2026-03-04T04:00:00.000Z",
  };
}

function ytSnapshot(count: number): YTCountSnapshot {
  return {
    source: "gwct_equipment_status",
    totalLoggedIn: count,
    totalKnown: 30,
    threshold: 25,
    signature: `yt:${count}`,
    seenAt: "2026-03-04T04:00:00.000Z",
  };
}

function weatherSnapshot(
  semanticState: WeatherNoticeSnapshot["semanticState"],
  text: string,
): WeatherNoticeSnapshot {
  return {
    source: "ys_forecast",
    dutyText: text,
    dispatchTeamDutyText: text,
    standbyCallText: "1대기:O.K",
    noticeHeadline: null,
    suspensionState: semanticState === "SUSPENDED" ? "all" : "none",
    semanticState,
    matchedKeywords: semanticState === "SUSPENDED" ? ["도선 중단"] : ["1대기"],
    normalizedReason: text,
    severity: semanticState === "SUSPENDED" ? "critical" : "normal",
    signature: `${semanticState}:${text}`,
    seenAt: "2026-03-04T04:00:00.000Z",
  };
}

describe("monitor semantic dedupe regression", () => {
  it("does not emit events when semantic fingerprint is unchanged", () => {
    const etaEvents = detectGwctEtaChangedEvents(
      [vessel("MSC_TINA_001", "2026-03-04T04:00:00.000Z")],
      [vessel("MSC_TINA_001", "2026-03-04T04:00:00.000Z")],
      "gwct_schedule_list",
      "2026-03-04T04:10:00.000Z",
      {
        sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=H&s=A",
        trackingCount: 11,
      },
    );
    expect(etaEvents).toHaveLength(0);

    const gcEvents = detectGcRemainingLowEvents(
      [gcRemaining("GC188", 6, 4)],
      [gcRemaining("GC188", 6, 4)],
      {
        "188": {
          enabled: true,
          threshold: 10,
        },
      },
      "gwct_gc_remaining",
      "2026-03-04T04:10:00.000Z",
      {
        sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=F&s=A",
      },
    );
    expect(gcEvents).toHaveLength(0);

    const gcStaffEvents = detectGcEquipmentFocusEvents(
      [equipment("GC188", "Kim", "HKLee", "03-04 12:00", null)],
      [equipment("GC188", "Kim", "HKLee", "03-04 12:00", null)],
      "gwct_equipment_status",
      "2026-03-04T04:10:00.000Z",
      {
        sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=D&s=A",
      },
    );
    expect(gcStaffEvents).toHaveLength(0);

    const ytEvents = detectYtCountStateEvents(
      ytSnapshot(23),
      {
        enabled: true,
        threshold: 25,
        stateInitialized: true,
        state: "LOW",
      },
      "gwct_equipment_status",
      "2026-03-04T04:10:00.000Z",
      {
        sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=D&s=A",
        previousCount: 23,
      },
    );
    expect(ytEvents.events).toHaveLength(0);

    const weatherEvents = diffWeather(
      weatherSnapshot("SUSPENDED", "기상 악화로 도선 중단"),
      weatherSnapshot("SUSPENDED", "13시30분부로 전체 도선 중단"),
      "ys_forecast",
      "2026-03-04T04:10:00.000Z",
    );
    expect(weatherEvents).toHaveLength(0);
  });
});
