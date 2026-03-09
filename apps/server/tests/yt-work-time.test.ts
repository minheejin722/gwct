import { describe, expect, it } from "vitest";
import type { YTUnitSnapshot, YTSemanticState } from "@gwct/shared";
import {
  applyYtWorkSnapshot,
  deriveYtWorkShiftIndicator,
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
    expect(view?.drivers[0]?.totalWorkedMinutes).toBe(40);
    expect(view?.drivers[0]?.latestState).toBe("stopped");

    session = applyYtWorkSnapshot(session, [unit("YT23", "Hong", "active")], "2026-03-07T04:30:00.000Z"); // 13:30 KST
    view = materializeYtWorkSession(session, "2026-03-07T05:00:00.000Z"); // 14:00 KST
    expect(view?.drivers[0]?.totalWorkedMinutes).toBe(70);

    session = applyYtWorkSnapshot(session, [unit("YT23", null, "logged_out")], "2026-03-07T05:10:00.000Z"); // 14:10 KST
    view = materializeYtWorkSession(session, "2026-03-07T05:10:00.000Z");
    expect(view?.drivers[0]?.totalWorkedMinutes).toBe(80);
    expect(view?.drivers[0]?.latestState).toBe("logged_out");
    expect(view?.drivers[0]?.segments).toBe(2);
  });

  it("finalizes an active night session at shift end and subtracts the midnight break", () => {
    const sessionStartedAt = "2026-03-07T14:30:00.000Z"; // 23:30 KST
    const session = startYtWorkSessionState("night", sessionStartedAt, [unit("YT11", "Kim", "active")]);
    const view = materializeYtWorkSession(session, "2026-03-07T22:05:00.000Z"); // 07:05 KST next day

    expect(view?.status).toBe("completed");
    expect(view?.completedAt).toBe("2026-03-07T21:45:00.000Z");
    expect(view?.drivers[0]?.totalWorkedMinutes).toBe(395);
    expect(view?.drivers[0]?.totalWorkedLabel).toBe("6시간 35분");
  });

  it("reports a paused break indicator during the fixed lunch window", () => {
    const sessionStartedAt = "2026-03-07T02:50:00.000Z"; // 11:50 KST
    const session = startYtWorkSessionState("day", sessionStartedAt, [unit("YT23", "Hong", "active")]);
    const view = materializeYtWorkSession(session, "2026-03-07T03:10:00.000Z"); // 12:10 KST
    const indicator = deriveYtWorkShiftIndicator(view, "2026-03-07T03:10:00.000Z", true);

    expect(indicator).toMatchObject({
      state: "paused",
      reason: "break_time",
      mode: "day",
      label: "일시 정지",
    });
  });

  it("keeps the break pause through the meal window and waits 30 minutes after break end before team_off", () => {
    const sessionStartedAt = "2026-03-07T14:50:00.000Z"; // 23:50 KST
    let session = startYtWorkSessionState("night", sessionStartedAt, [unit("YT11", "Kim", "active")]);

    session = applyYtWorkSnapshot(
      session,
      [unit("YT11", "Kim", "stopped", "식사")],
      "2026-03-07T15:05:00.000Z", // 00:05 KST
    );

    let view = materializeYtWorkSession(session, "2026-03-07T15:20:00.000Z"); // 00:20 KST
    let indicator = deriveYtWorkShiftIndicator(view, "2026-03-07T15:20:00.000Z", true);
    expect(indicator).toMatchObject({
      state: "paused",
      reason: "break_time",
      mode: "night",
      label: "일시 정지",
    });
    expect(view?.drivers).toHaveLength(1);
    expect(view?.drivers[0]?.driverName).toBe("Kim");

    view = materializeYtWorkSession(session, "2026-03-07T16:05:00.000Z"); // 01:05 KST
    indicator = deriveYtWorkShiftIndicator(view, "2026-03-07T16:05:00.000Z", true);
    expect(indicator).toMatchObject({
      state: "paused",
      reason: "awaiting_login",
      mode: "night",
      label: "일시 정지",
    });
    expect(view?.drivers).toHaveLength(1);

    view = materializeYtWorkSession(session, "2026-03-07T16:10:00.000Z"); // 01:10 KST
    indicator = deriveYtWorkShiftIndicator(view, "2026-03-07T16:10:00.000Z", true);
    expect(indicator).toMatchObject({
      state: "paused",
      reason: "team_off",
      mode: "night",
      label: "일시 정지",
    });
    expect(view?.drivers).toHaveLength(1);
  });

  it("preserves pre-break accumulated time when night-shift work resumes after the midnight meal break", () => {
    const sessionStartedAt = "2026-03-07T14:50:00.000Z"; // 23:50 KST
    let session = startYtWorkSessionState("night", sessionStartedAt, [unit("YT11", "Kim", "active")]);

    session = applyYtWorkSnapshot(
      session,
      [unit("YT11", "Kim", "stopped", "식사")],
      "2026-03-07T15:10:00.000Z", // 00:10 KST
    );

    let view = materializeYtWorkSession(session, "2026-03-07T15:10:00.000Z");
    expect(view?.drivers[0]?.totalWorkedMinutes).toBe(10);
    expect(view?.drivers[0]?.segments).toBe(1);
    expect(view?.drivers[0]?.latestState).toBe("stopped");

    session = applyYtWorkSnapshot(session, [unit("YT11", "Kim", "active")], "2026-03-07T16:20:00.000Z"); // 01:20 KST
    view = materializeYtWorkSession(session, "2026-03-07T16:40:00.000Z"); // 01:40 KST

    expect(view?.drivers[0]?.driverName).toBe("Kim");
    expect(view?.drivers[0]?.totalWorkedMinutes).toBe(30);
    expect(view?.drivers[0]?.segments).toBe(1);
    expect(view?.drivers[0]?.latestState).toBe("active");
    expect(view?.drivers[0]?.currentSegmentStartedAt).toBe("2026-03-07T16:20:00.000Z");
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

  it("keeps counting through over-height stop and logout until the driver relogs in", () => {
    const observedAt = "2026-03-07T01:00:00.000Z"; // 10:00 KST
    let session = startYtWorkSessionState("day", observedAt, [unit("YT23", "Hong", "active")]);

    session = applyYtWorkSnapshot(
      session,
      [unit("YT23", "Hong", "stopped", "B/BULK(오바잇(와이어)작업)")],
      "2026-03-07T01:10:00.000Z",
    );

    let view = materializeYtWorkSession(session, "2026-03-07T01:20:00.000Z");
    let hong = view?.drivers.find((driver) => driver.driverName === "Hong");

    expect(hong?.latestState).toBe("stopped");
    expect(hong?.currentSegmentStartedAt).toBe(observedAt);
    expect(hong?.segments).toBe(0);
    expect(hong?.totalWorkedMinutes).toBe(20);
    expect(hong?.adjustmentDeltaMinutes).toBe(30);
    expect(hong?.stopReasonCounters).toEqual([
      { kind: "over_high", label: "오바하이", count: 1 },
    ]);

    session = applyYtWorkSnapshot(
      session,
      [unit("YT23", null, "logged_out", "와이어 작업")],
      "2026-03-07T01:30:00.000Z",
    );
    session = applyYtWorkSnapshot(session, [], "2026-03-07T01:40:00.000Z");

    view = materializeYtWorkSession(session, "2026-03-07T01:50:00.000Z");
    hong = view?.drivers.find((driver) => driver.driverName === "Hong");

    expect(hong?.latestState).toBe("logged_out");
    expect(hong?.currentSegmentStartedAt).toBe(observedAt);
    expect(hong?.segments).toBe(0);
    expect(hong?.totalWorkedMinutes).toBe(50);
    expect(hong?.adjustmentDeltaMinutes).toBe(30);
    expect(hong?.stopReasonCounters).toEqual([
      { kind: "over_high", label: "오바하이", count: 1 },
    ]);

    session = applyYtWorkSnapshot(session, [unit("YT77", "Hong", "active")], "2026-03-07T02:00:00.000Z");
    view = materializeYtWorkSession(session, "2026-03-07T02:10:00.000Z");
    hong = view?.drivers.find((driver) => driver.driverName === "Hong");

    expect(hong?.latestState).toBe("active");
    expect(hong?.activeYtNo).toBe("YT77");
    expect(hong?.currentSegmentStartedAt).toBe(observedAt);
    expect(hong?.segments).toBe(0);
    expect(hong?.totalWorkedMinutes).toBe(70);
    expect(hong?.adjustedWorkedMinutes).toBe(100);
    expect(hong?.adjustmentDeltaLabel).toBe("+0시간 30분");
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
    expect(hong?.adjustmentDeltaMinutes).toBe(45);
    expect(hong?.adjustmentDeltaLabel).toBe("+0시간 45분");
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
    expect(view?.drivers[0]?.totalWorkedMinutes).toBe(30);
    expect(view?.drivers[0]?.adjustedWorkedMinutes).toBe(60);
    expect(view?.drivers[0]?.adjustmentDeltaLabel).toBe("+0시간 30분");
    expect(view?.drivers[1]?.totalWorkedMinutes).toBe(20);
    expect(view?.drivers[1]?.adjustedWorkedMinutes).toBe(5);
    expect(view?.drivers[1]?.adjustmentDeltaLabel).toBe("-0시간 15분");
  });

  it("keeps equal minutes through the midnight meal break but ranks tied drivers by earlier start time", () => {
    let session = startYtWorkSessionState("night", "2026-03-09T15:05:00.000Z", [unit("YT11", "Zulu", "active")]); // 00:05 KST

    session = applyYtWorkSnapshot(
      session,
      [unit("YT11", "Zulu", "active"), unit("YT12", "Bravo", "active")],
      "2026-03-09T15:10:00.000Z", // 00:10 KST
    );
    session = applyYtWorkSnapshot(
      session,
      [unit("YT11", "Zulu", "active"), unit("YT12", "Bravo", "active"), unit("YT13", "Charlie", "active")],
      "2026-03-09T15:20:00.000Z", // 00:20 KST
    );
    session = applyYtWorkSnapshot(
      session,
      [
        unit("YT11", "Zulu", "active"),
        unit("YT12", "Bravo", "active"),
        unit("YT13", "Charlie", "active"),
        unit("YT14", "Alpha", "active"),
      ],
      "2026-03-09T15:35:00.000Z", // 00:35 KST
    );

    const view = materializeYtWorkSession(session, "2026-03-09T16:20:00.000Z"); // 01:20 KST

    expect(view?.drivers.map((driver) => driver.totalWorkedMinutes)).toEqual([40, 40, 40, 40]);
    expect(view?.drivers.map((driver) => driver.driverName)).toEqual(["Zulu", "Bravo", "Charlie", "Alpha"]);
    expect(view?.drivers.map((driver) => driver.firstSeenAt)).toEqual([
      "2026-03-09T15:05:00.000Z",
      "2026-03-09T15:10:00.000Z",
      "2026-03-09T15:20:00.000Z",
      "2026-03-09T15:35:00.000Z",
    ]);
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

  it("pauses the shift after the +30 minute grace passes with zero logged-in YTs and resumes on the next login", () => {
    let session = reconcileYtWorkSnapshotState(
      null,
      [unit("YT23", null, "logged_out")],
      "2026-03-06T22:20:00.000Z", // 07:20 KST
    );

    let view = materializeYtWorkSession(session, "2026-03-06T22:20:00.000Z");
    let indicator = deriveYtWorkShiftIndicator(view, "2026-03-06T22:20:00.000Z", true);

    expect(view?.drivers).toHaveLength(0);
    expect(indicator).toMatchObject({
      state: "paused",
      reason: "team_off",
      mode: "day",
      label: "일시 정지",
    });

    session = reconcileYtWorkSnapshotState(
      session,
      [unit("YT23", "Hong", "active")],
      "2026-03-06T23:00:00.000Z", // 08:00 KST
    );

    view = materializeYtWorkSession(session, "2026-03-06T23:10:00.000Z"); // 08:10 KST
    indicator = deriveYtWorkShiftIndicator(view, "2026-03-06T23:10:00.000Z", true);

    expect(indicator).toMatchObject({
      state: "collecting",
      reason: "active_shift",
      mode: "day",
      label: "집계중",
    });
    expect(view?.drivers).toHaveLength(1);
    expect(view?.drivers[0]?.driverName).toBe("Hong");
    expect(view?.drivers[0]?.totalWorkedMinutes).toBe(10);
  });

  it("keeps the shift in collecting mode during an over-height logout stretch", () => {
    let session = reconcileYtWorkSnapshotState(
      null,
      [unit("YT23", "Hong", "active")],
      "2026-03-06T21:50:00.000Z", // 06:50 KST
    );

    session = reconcileYtWorkSnapshotState(
      session,
      [unit("YT23", null, "logged_out", "B/BULK(오바잇(와이어)작업)")],
      "2026-03-06T22:30:00.000Z", // 07:30 KST
    );

    const view = materializeYtWorkSession(session, "2026-03-06T22:40:00.000Z"); // 07:40 KST
    const indicator = deriveYtWorkShiftIndicator(view, "2026-03-06T22:40:00.000Z", true);

    expect(indicator).toMatchObject({
      state: "collecting",
      reason: "active_shift",
      mode: "day",
      label: "집계중",
    });
    expect(view?.drivers[0]?.driverName).toBe("Hong");
    expect(view?.drivers[0]?.latestState).toBe("logged_out");
    expect(view?.drivers[0]?.totalWorkedMinutes).toBe(50);
    expect(view?.drivers[0]?.adjustmentDeltaLabel).toBe("+0시간 30분");
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

