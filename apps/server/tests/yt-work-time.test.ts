import { describe, expect, it } from "vitest";
import type { YTUnitSnapshot, YTSemanticState } from "@gwct/shared";
import {
  applyYtWorkSnapshot,
  materializeYtWorkSession,
  reconcileYtWorkSnapshotState,
  startYtWorkSessionState,
} from "../src/services/ytWorkTime/service.js";

function unit(
  ytNo: string,
  driverName: string | null,
  semanticState: YTSemanticState,
  stopReason: string | null = null,
): YTUnitSnapshot {
  return {
    ytNo,
    driverName,
    loginTime: null,
    hkName: null,
    stopReason,
    semanticState,
    fingerprint: `${ytNo}:${driverName || "-"}:${semanticState}:${stopReason || "-"}`,
  };
}

describe("YT work-time session rules", () => {
  it("starts a day session from currently active YT drivers only", () => {
    const observedAt = "2026-03-07T01:00:00.000Z"; // 10:00 KST
    const session = startYtWorkSessionState("day", observedAt, [
      unit("YT23", "Hong", "active"),
      unit("YT24", "Kim", "stopped", "식사"),
      unit("YT25", null, "logged_out"),
    ]);
    const view = materializeYtWorkSession(session, observedAt);

    expect(view?.mode).toBe("day");
    expect(view?.status).toBe("active");
    expect(view?.drivers).toHaveLength(1);
    expect(view?.drivers[0]?.driverName).toBe("Hong");
    expect(view?.drivers[0]?.currentSegmentStartedAt).toBe(observedAt);
    expect(view?.drivers[0]?.activeYtNo).toBe("YT23");
  });

  it("accumulates across relogin segments and subtracts the lunch break overlap", () => {
    const sessionStartedAt = "2026-03-07T02:50:00.000Z"; // 11:50 KST
    let session = startYtWorkSessionState("day", sessionStartedAt, [unit("YT23", "Hong", "active")]);

    let view = materializeYtWorkSession(session, "2026-03-07T03:10:00.000Z"); // 12:10 KST
    expect(view?.drivers[0]?.totalWorkedMinutes).toBe(10);

    session = applyYtWorkSnapshot(
      session,
      [unit("YT23", "Hong", "stopped", "식사시간")],
      "2026-03-07T04:10:00.000Z", // 13:10 KST
    );
    view = materializeYtWorkSession(session, "2026-03-07T04:10:00.000Z");
    expect(view?.drivers[0]?.totalWorkedMinutes).toBe(20);
    expect(view?.drivers[0]?.latestState).toBe("stopped");

    session = applyYtWorkSnapshot(session, [unit("YT23", "Hong", "active")], "2026-03-07T04:30:00.000Z"); // 13:30 KST
    view = materializeYtWorkSession(session, "2026-03-07T05:00:00.000Z"); // 14:00 KST
    expect(view?.drivers[0]?.totalWorkedMinutes).toBe(50);

    session = applyYtWorkSnapshot(session, [unit("YT23", null, "logged_out")], "2026-03-07T05:10:00.000Z"); // 14:10 KST
    view = materializeYtWorkSession(session, "2026-03-07T05:10:00.000Z");
    expect(view?.drivers[0]?.totalWorkedMinutes).toBe(60);
    expect(view?.drivers[0]?.latestState).toBe("logged_out");
    expect(view?.drivers[0]?.segments).toBe(2);
  });

  it("finalizes an active night session at shift end and subtracts the midnight break", () => {
    const sessionStartedAt = "2026-03-07T14:30:00.000Z"; // 23:30 KST
    const session = startYtWorkSessionState("night", sessionStartedAt, [unit("YT11", "Kim", "active")]);
    const view = materializeYtWorkSession(session, "2026-03-07T22:05:00.000Z"); // 07:05 KST next day

    expect(view?.status).toBe("completed");
    expect(view?.completedAt).toBe("2026-03-07T21:45:00.000Z");
    expect(view?.drivers[0]?.totalWorkedMinutes).toBe(375);
    expect(view?.drivers[0]?.totalWorkedLabel).toBe("6시간 15분");
  });

  it("preserves the last stop reason when a stopped driver fully logs out", () => {
    const observedAt = "2026-03-07T01:00:00.000Z"; // 10:00 KST
    let session = startYtWorkSessionState("day", observedAt, [unit("YT23", "Hong", "active")]);

    session = applyYtWorkSnapshot(
      session,
      [unit("YT23", "Hong", "stopped", "정비대기")],
      "2026-03-07T01:30:00.000Z",
    );

    session = applyYtWorkSnapshot(session, [unit("YT23", null, "logged_out")], "2026-03-07T01:40:00.000Z");

    const view = materializeYtWorkSession(session, "2026-03-07T01:40:00.000Z");
    expect(view?.drivers[0]?.latestState).toBe("logged_out");
    expect(view?.drivers[0]?.latestStopReason).toBe("정비대기");
  });

  it("reads the final stop reason from a driverless logged_out YT row", () => {
    const observedAt = "2026-03-07T01:00:00.000Z"; // 10:00 KST
    let session = startYtWorkSessionState("day", observedAt, [unit("YT23", "Hong", "active")]);

    session = applyYtWorkSnapshot(
      session,
      [unit("YT23", null, "logged_out", "해치커버")],
      "2026-03-07T01:20:00.000Z",
    );

    const view = materializeYtWorkSession(session, "2026-03-07T01:20:00.000Z");
    expect(view?.drivers[0]?.latestState).toBe("logged_out");
    expect(view?.drivers[0]?.latestStopReason).toBe("해치커버");
  });

  it("keeps accumulating for the same driver after relogin on a different YT", () => {
    const observedAt = "2026-03-07T01:00:00.000Z"; // 10:00 KST
    let session = startYtWorkSessionState("day", observedAt, [unit("YT23", "Hong", "active")]);

    session = applyYtWorkSnapshot(session, [unit("YT23", "Hong", "stopped", "식사")], "2026-03-07T01:30:00.000Z");
    session = applyYtWorkSnapshot(session, [unit("YT77", "Hong", "active")], "2026-03-07T01:40:00.000Z");

    const view = materializeYtWorkSession(session, "2026-03-07T02:10:00.000Z");
    expect(view?.drivers).toHaveLength(1);
    expect(view?.drivers[0]?.driverName).toBe("Hong");
    expect(view?.drivers[0]?.latestYtNo).toBe("YT77");
    expect(view?.drivers[0]?.activeYtNo).toBe("YT77");
    expect(view?.drivers[0]?.segments).toBe(1);
    expect(view?.drivers[0]?.totalWorkedMinutes).toBe(60);
  });

  it("tracks repeated special stop-reason keywords across separate work interruptions", () => {
    const observedAt = "2026-03-07T01:00:00.000Z"; // 10:00 KST
    let session = startYtWorkSessionState("day", observedAt, [unit("YT23", "Hong", "active")]);

    session = applyYtWorkSnapshot(session, [unit("YT23", "Hong", "stopped", "오바 중단")], "2026-03-07T01:10:00.000Z");
    session = applyYtWorkSnapshot(session, [unit("YT23", "Hong", "stopped", "오바 중단")], "2026-03-07T01:11:00.000Z");
    session = applyYtWorkSnapshot(session, [unit("YT23", "Hong", "active")], "2026-03-07T01:20:00.000Z");

    session = applyYtWorkSnapshot(session, [unit("YT23", null, "logged_out", "오바 추가")], "2026-03-07T01:30:00.000Z");
    session = applyYtWorkSnapshot(session, [unit("YT77", "Hong", "active")], "2026-03-07T01:40:00.000Z");

    session = applyYtWorkSnapshot(
      session,
      [unit("YT77", "Hong", "stopped", "캐빈 셔틀 이동")],
      "2026-03-07T01:50:00.000Z",
    );
    session = applyYtWorkSnapshot(session, [unit("YT77", "Hong", "active")], "2026-03-07T02:00:00.000Z");

    session = applyYtWorkSnapshot(
      session,
      [unit("YT77", "Hong", "stopped", "본선작업 요청으로 중단")],
      "2026-03-07T02:10:00.000Z",
    );
    session = applyYtWorkSnapshot(session, [unit("YT77", "Hong", "active")], "2026-03-07T02:20:00.000Z");
    session = applyYtWorkSnapshot(
      session,
      [unit("YT77", "Hong", "stopped", "화장실")],
      "2026-03-07T02:30:00.000Z",
    );

    const view = materializeYtWorkSession(session, "2026-03-07T02:30:00.000Z");
    const hong = view?.drivers.find((driver) => driver.driverName === "Hong");

    expect(hong?.stopReasonCounters).toEqual([
      { kind: "over_high", label: "오바하이", count: 2 },
      { kind: "cabin_shuttle", label: "캐빈셔틀", count: 1 },
      { kind: "ship_work_request_stop", label: "본선작업요청중단", count: 1 },
      { kind: "restroom", label: "화장실", count: 1 },
    ]);
    expect(hong?.adjustmentDeltaMinutes).toBe(55);
    expect(hong?.adjustmentDeltaLabel).toBe("+0시간 55분");
  });

  it("ranks drivers by adjusted worked time after plus and minus stop-reason rules", () => {
    const observedAt = "2026-03-07T01:00:00.000Z"; // 10:00 KST
    let session = startYtWorkSessionState("day", observedAt, [
      unit("YT23", "Hong", "active"),
      unit("YT24", "Kim", "active"),
    ]);

    session = applyYtWorkSnapshot(
      session,
      [unit("YT23", "Hong", "stopped", "오바 작업"), unit("YT24", "Kim", "active")],
      "2026-03-07T01:10:00.000Z",
    );
    session = applyYtWorkSnapshot(
      session,
      [unit("YT23", "Hong", "active"), unit("YT24", "Kim", "stopped", "화장실")],
      "2026-03-07T01:20:00.000Z",
    );
    session = applyYtWorkSnapshot(
      session,
      [unit("YT23", "Hong", "active"), unit("YT24", "Kim", "stopped", "화장실")],
      "2026-03-07T01:30:00.000Z",
    );

    const view = materializeYtWorkSession(session, "2026-03-07T01:30:00.000Z");

    expect(view?.drivers.map((driver) => driver.driverName)).toEqual(["Hong", "Kim"]);
    expect(view?.drivers[0]?.totalWorkedMinutes).toBe(20);
    expect(view?.drivers[0]?.adjustedWorkedMinutes).toBe(55);
    expect(view?.drivers[0]?.adjustmentDeltaLabel).toBe("+0시간 35분");
    expect(view?.drivers[1]?.totalWorkedMinutes).toBe(20);
    expect(view?.drivers[1]?.adjustedWorkedMinutes).toBe(5);
    expect(view?.drivers[1]?.adjustmentDeltaLabel).toBe("-0시간 15분");
  });

  it("closes the previous driver and starts a new driver when the same YT is handed off", () => {
    const observedAt = "2026-03-07T01:00:00.000Z"; // 10:00 KST
    let session = startYtWorkSessionState("day", observedAt, [unit("YT23", "Hong", "active")]);

    session = applyYtWorkSnapshot(session, [unit("YT23", "Kim", "active")], "2026-03-07T01:30:00.000Z");

    const view = materializeYtWorkSession(session, "2026-03-07T02:00:00.000Z");
    expect(view?.drivers).toHaveLength(2);

    const hong = view?.drivers.find((driver) => driver.driverName === "Hong");
    const kim = view?.drivers.find((driver) => driver.driverName === "Kim");

    expect(hong?.latestState).toBe("logged_out");
    expect(hong?.activeYtNo).toBeNull();
    expect(hong?.segments).toBe(1);
    expect(hong?.totalWorkedMinutes).toBe(30);

    expect(kim?.latestState).toBe("active");
    expect(kim?.activeYtNo).toBe("YT23");
    expect(kim?.segments).toBe(0);
    expect(kim?.totalWorkedMinutes).toBe(30);
  });

  it("starts the current shift automatically from the first snapshot without any manual trigger", () => {
    const session = reconcileYtWorkSnapshotState(
      null,
      [unit("YT23", "Hong", "active")],
      "2026-03-07T01:00:00.000Z",
    );

    expect(session?.mode).toBe("day");
    expect(session?.shiftWindowStartedAt).toBe("2026-03-06T21:45:00.000Z");
    expect(session?.startedAt).toBe("2026-03-07T01:00:00.000Z");
  });

  it("rolls the stored session forward automatically when the shift boundary changes", () => {
    let session = reconcileYtWorkSnapshotState(
      null,
      [unit("YT23", "Hong", "active")],
      "2026-03-07T01:00:00.000Z",
    );

    session = reconcileYtWorkSnapshotState(
      session,
      [unit("YT23", "Hong", "active")],
      "2026-03-07T09:50:00.000Z",
    );

    expect(session?.mode).toBe("night");
    expect(session?.shiftWindowStartedAt).toBe("2026-03-07T09:45:00.000Z");
    expect(session?.startedAt).toBe("2026-03-07T09:50:00.000Z");
  });

  it("ignores stale older snapshots instead of overwriting a newer current-shift session", () => {
    const current = reconcileYtWorkSnapshotState(
      null,
      [unit("YT23", "Hong", "active")],
      "2026-03-07T09:50:00.000Z",
    );

    const stale = reconcileYtWorkSnapshotState(
      current,
      [unit("YT23", null, "logged_out", "정비")],
      "2026-03-07T09:40:00.000Z",
    );

    expect(stale).toEqual(current);
  });
});

