import { describe, expect, it } from "vitest";
import type { WeatherNoticeSnapshot } from "@gwct/shared";
import { buildEffectiveYeosuSnapshot, buildYeosuObservedText } from "../src/services/yeosu/effectiveState.js";

function weatherSnapshot(
  overrides: Partial<WeatherNoticeSnapshot>,
): WeatherNoticeSnapshot {
  return {
    source: "ys_forecast",
    dutyText: null,
    dispatchTeamDutyText: null,
    standbyCallText: null,
    noticeHeadline: null,
    suspensionState: "none",
    semanticState: "NORMAL",
    matchedKeywords: [],
    normalizedReason: null,
    severity: "normal",
    signature: "sig",
    seenAt: "2026-03-07T04:45:00.000Z",
    ...overrides,
  };
}

describe("buildEffectiveYeosuSnapshot", () => {
  it("upgrades forecast to suspended when recent board evidence says pilotage is suspended", () => {
    const forecast = weatherSnapshot({
      source: "ys_forecast",
      dispatchTeamDutyText: "■김현후.염규일",
      standbyCallText: "■1대기:LJ.LH",
      suspensionState: "none",
      semanticState: "NORMAL",
      normalizedReason: "NORMAL:standby:1대기",
      signature: "forecast",
    });
    const notice = weatherSnapshot({
      source: "ys_notice",
      noticeHeadline: "기상 악화로 전체 도선 중단",
      suspensionState: "all",
      semanticState: "SUSPENDED",
      matchedKeywords: ["board:전체 도선 중단", "board:기상 악화"],
      normalizedReason: "SUSPENDED:board:전체 도선 중단",
      severity: "critical",
      signature: "notice",
      seenAt: "2026-03-07T04:46:00.000Z",
    });

    const effective = buildEffectiveYeosuSnapshot({
      forecast,
      notice,
      news: null,
      fallbackState: "none",
    });

    expect(effective?.semanticState).toBe("SUSPENDED");
    expect(effective?.dispatchTeamDutyText).toBe("■김현후.염규일");
    expect(effective?.standbyCallText).toBe("■1대기:LJ.LH");
    expect(effective?.noticeHeadline).toContain("전체 도선 중단");
    expect(effective?.matchedKeywords).toContain("board:전체 도선 중단");
  });

  it("keeps forecast text while building a readable observed text", () => {
    const effective = weatherSnapshot({
      dispatchTeamDutyText: "■홍상철.윤지환",
      standbyCallText: "■13시30분부로 기상 악화로 인하여 전체 도선 중단",
      noticeHeadline: "기상 악화로 전체 도선 중단",
    });

    expect(buildYeosuObservedText(effective)).toContain("배선팀근무");
    expect(buildYeosuObservedText(effective)).toContain("대기호출자");
    expect(buildYeosuObservedText(effective)).toContain("보조공지");
  });
});
