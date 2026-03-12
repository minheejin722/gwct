import { normalizeYtDriverIdentityInput } from "@gwct/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearYtMasterCallStateForTest } from "../src/services/ytMasterCall/store.js";
import {
  cancelYtMasterCall,
  clearYtMasterCallRegistration,
  createYtMasterCall,
  decideYtMasterCall,
  getYtMasterCallLiveState,
  saveYtMasterCallRegistration,
  updateYtMasterCallVisibility,
} from "../src/services/ytMasterCall/service.js";

process.env.YT_MASTER_CALL_STATE_FILE = "yt_master_call_state.service.test.json";

afterEach(async () => {
  await clearYtMasterCallStateForTest();
});

describe("yt master call service", () => {
  it("splits noisy combined driver identity input into yt number and name", () => {
    const variants = [
      "600홍길동",
      "600 홍길동",
      "홍길동600",
      "홍길동 600",
      "6 00홍 길동",
      "60 0 홍 길 동",
      "60,0 홍-길.동",
    ];

    for (const variant of variants) {
      expect(normalizeYtDriverIdentityInput(variant)).toMatchObject({
        ytNumber: "YT-600",
        ytNumberDigits: "600",
        name: "홍길동",
      });
    }
  });

  it("normalizes noisy driver registration input before storing it", async () => {
    const live = await saveYtMasterCallRegistration({
      deviceId: "driver-fuzzy-1",
      role: "driver",
      name: "홍-길.동",
      ytNumber: "60,0",
    });

    expect(live.registration).toMatchObject({
      role: "driver",
      name: "홍길동",
      ytNumber: "YT-600",
    });
  });

  it("assigns only two master slots globally", async () => {
    const masterOne = await saveYtMasterCallRegistration({
      deviceId: "master-1",
      role: "master",
      name: "Lee",
    });
    const masterTwo = await saveYtMasterCallRegistration({
      deviceId: "master-2",
      role: "master",
      name: "Park",
    });

    expect(masterOne.registration?.masterSlot).toBe("MASTER-1");
    expect(masterTwo.registration?.masterSlot).toBe("MASTER-2");

    await expect(
      saveYtMasterCallRegistration({
        deviceId: "master-3",
        role: "master",
        name: "Choi",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("blocks driver role clear while a pending call exists", async () => {
    await saveYtMasterCallRegistration({
      deviceId: "driver-1",
      role: "driver",
      name: "Kim",
      ytNumber: "45",
    });
    await createYtMasterCall({
      deviceId: "driver-1",
      reasonCode: "tractor_inspection",
    });

    await expect(clearYtMasterCallRegistration("driver-1")).rejects.toMatchObject({
      statusCode: 409,
    });

    const live = await getYtMasterCallLiveState("driver-1");
    expect(live.currentCall?.status).toBe("pending");
    expect(live.registration?.role).toBe("driver");
  });

  it("cancels a pending driver call and hides it from current state", async () => {
    await saveYtMasterCallRegistration({
      deviceId: "driver-2",
      role: "driver",
      name: "Han",
      ytNumber: "18",
    });

    const liveAfterCreate = await createYtMasterCall({
      deviceId: "driver-2",
      reasonCode: "restroom",
    });
    const callId = liveAfterCreate.currentCall?.id;

    expect(callId).toBeTruthy();

    const cancelled = await cancelYtMasterCall(callId!, {
      deviceId: "driver-2",
    });

    expect(cancelled.call.status).toBe("cancelled");
    expect(cancelled.liveState.currentCall).toBeNull();
    expect(cancelled.liveState.pendingCount).toBe(0);
  });

  it("stores tractor inspection detail when a detailed tractor call is created", async () => {
    await saveYtMasterCallRegistration({
      deviceId: "driver-3",
      role: "driver",
      name: "Seo",
      ytNumber: "591",
    });

    const live = await createYtMasterCall({
      deviceId: "driver-3",
      reasonCode: "tractor_inspection",
      reasonDetailCode: "flat_tire",
    });

    expect(live.currentCall).toMatchObject({
      reasonCode: "tractor_inspection",
      reasonLabel: "트랙터 점검",
      reasonDetailCode: "flat_tire",
      reasonDetailLabel: "타이어 펑크",
      status: "pending",
    });
  });

  it("stores the new wheel-detached tractor detail label", async () => {
    await saveYtMasterCallRegistration({
      deviceId: "driver-3b",
      role: "driver",
      name: "Seo",
      ytNumber: "592",
    });

    const live = await createYtMasterCall({
      deviceId: "driver-3b",
      reasonCode: "tractor_inspection",
      reasonDetailCode: "wheel_detached",
    });

    expect(live.currentCall).toMatchObject({
      reasonCode: "tractor_inspection",
      reasonDetailCode: "wheel_detached",
      reasonDetailLabel: "바퀴 빠짐",
      handlingMode: "message",
      status: "sent",
    });
  });

  it("stores emergency accident calls as message-only without tractor detail", async () => {
    await saveYtMasterCallRegistration({
      deviceId: "driver-4",
      role: "driver",
      name: "Jang",
      ytNumber: "500",
    });

    const live = await createYtMasterCall({
      deviceId: "driver-4",
      reasonCode: "emergency_accident",
    });

    expect(live.currentCall).toMatchObject({
      reasonCode: "emergency_accident",
      reasonLabel: "긴급 사고",
      reasonDetailCode: null,
      reasonDetailLabel: null,
      handlingMode: "message",
      status: "sent",
    });
  });

  it("stores other reason detail when a detailed other call is created", async () => {
    await saveYtMasterCallRegistration({
      deviceId: "master-5",
      role: "master",
      name: "Lee",
    });
    await saveYtMasterCallRegistration({
      deviceId: "driver-5",
      role: "driver",
      name: "Yoon",
      ytNumber: "320",
    });

    const live = await createYtMasterCall({
      deviceId: "driver-5",
      reasonCode: "other",
      reasonDetailCode: "gc181_cabin_report",
    });

    expect(live.currentCall).toMatchObject({
      reasonCode: "other",
      reasonLabel: "기타 사유",
      reasonDetailCode: "gc181_cabin_report",
      reasonDetailLabel: "GC181 고발",
      handlingMode: "message",
      status: "sent",
    });
  });

  it("stores the selected day-off schedule date on other calls", async () => {
    await saveYtMasterCallRegistration({
      deviceId: "driver-dayoff-1",
      role: "driver",
      name: "Yoon",
      ytNumber: "321",
    });

    const live = await createYtMasterCall({
      deviceId: "driver-dayoff-1",
      reasonCode: "other",
      reasonDetailCode: "day_off_schedule",
      reasonDetailValue: "2026-03-25",
    });

    expect(live.currentCall).toMatchObject({
      reasonCode: "other",
      reasonDetailCode: "day_off_schedule",
      reasonDetailLabel: "휴무일정 03.25",
      reasonDetailValue: "2026-03-25",
      handlingMode: "decision",
      status: "pending",
    });
  });

  it("stores multiple marked day-off dates on other calls", async () => {
    await saveYtMasterCallRegistration({
      deviceId: "driver-dayoff-2",
      role: "driver",
      name: "Yoon",
      ytNumber: "322",
    });

    const live = await createYtMasterCall({
      deviceId: "driver-dayoff-2",
      reasonCode: "other",
      reasonDetailCode: "day_off_schedule",
      reasonDetailValue: "2026-03-25,2026-03-26,2026-03-27,2026-04-02",
    });

    expect(live.currentCall).toMatchObject({
      reasonCode: "other",
      reasonDetailCode: "day_off_schedule",
      reasonDetailLabel: "휴무일정 03.25~03.27, 04.02",
      reasonDetailValue: "2026-03-25,2026-03-26,2026-03-27,2026-04-02",
      handlingMode: "decision",
      status: "pending",
    });
  });

  it("acknowledges a message-only call and keeps it visible in the master queue", async () => {
    await saveYtMasterCallRegistration({
      deviceId: "master-6",
      role: "master",
      name: "Park",
    });
    await saveYtMasterCallRegistration({
      deviceId: "driver-6",
      role: "driver",
      name: "Min",
      ytNumber: "610",
    });

    const liveAfterCreate = await createYtMasterCall({
      deviceId: "driver-6",
      reasonCode: "other",
      reasonDetailCode: "suggestion",
    });
    const callId = liveAfterCreate.currentCall?.id;

    expect(liveAfterCreate.currentCall).toMatchObject({
      handlingMode: "message",
      status: "sent",
      reasonDetailCode: "suggestion",
    });
    expect(callId).toBeTruthy();

    const acknowledged = await decideYtMasterCall(callId!, {
      deviceId: "master-6",
      status: "acknowledged",
    });

    expect(acknowledged.call).toMatchObject({
      id: callId,
      handlingMode: "message",
      status: "acknowledged",
      resolvedByName: "Park",
    });
    expect(acknowledged.liveState.queue).toMatchObject([
      {
        id: callId,
        handlingMode: "message",
        status: "acknowledged",
        resolvedByName: "Park",
      },
    ]);

    const driverLive = await getYtMasterCallLiveState("driver-6");
    expect(driverLive.currentCall).toMatchObject({
      id: callId,
      handlingMode: "message",
      status: "acknowledged",
      resolvedByName: "Park",
    });
    expect(driverLive.pendingCount).toBe(0);

    const masterLive = await getYtMasterCallLiveState("master-6");
    expect(masterLive.queue).toMatchObject([
      {
        id: callId,
        handlingMode: "message",
        status: "acknowledged",
        resolvedByName: "Park",
      },
    ]);
  });

  it("treats container protrusion as a message-only other detail", async () => {
    await saveYtMasterCallRegistration({
      deviceId: "master-7",
      role: "master",
      name: "Park",
    });
    await saveYtMasterCallRegistration({
      deviceId: "driver-7",
      role: "driver",
      name: "Choi",
      ytNumber: "620",
    });

    const live = await createYtMasterCall({
      deviceId: "driver-7",
      reasonCode: "other",
      reasonDetailCode: "yard_container_first_lane_first_tier_protrusion",
    });

    expect(live.currentCall).toMatchObject({
      reasonCode: "other",
      reasonDetailCode: "yard_container_first_lane_first_tier_protrusion",
      reasonDetailLabel: "컨테이너 돌출",
      handlingMode: "message",
      status: "sent",
    });
  });

  it("blocks duplicate locked other reasons for twenty minutes across drivers", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-03-12T00:00:00.000Z"));

      await saveYtMasterCallRegistration({
        deviceId: "driver-lock-1",
        role: "driver",
        name: "Kim",
        ytNumber: "640",
      });
      await saveYtMasterCallRegistration({
        deviceId: "driver-lock-2",
        role: "driver",
        name: "Lee",
        ytNumber: "641",
      });

      await createYtMasterCall({
        deviceId: "driver-lock-1",
        reasonCode: "other",
        reasonDetailCode: "shift_shuttle",
      });

      await expect(
        createYtMasterCall({
          deviceId: "driver-lock-2",
          reasonCode: "other",
          reasonDetailCode: "shift_shuttle",
        }),
      ).rejects.toMatchObject({
        statusCode: 409,
        message: "같은 사유로 이미 메세지가 도달했습니다.",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("releases the duplicate lock after twenty minutes for selected other reasons", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-03-12T00:00:00.000Z"));

      await saveYtMasterCallRegistration({
        deviceId: "driver-lock-3",
        role: "driver",
        name: "Kim",
        ytNumber: "642",
      });
      await saveYtMasterCallRegistration({
        deviceId: "driver-lock-4",
        role: "driver",
        name: "Lee",
        ytNumber: "643",
      });

      await createYtMasterCall({
        deviceId: "driver-lock-3",
        reasonCode: "other",
        reasonDetailCode: "transshipment_done",
      });

      vi.setSystemTime(new Date("2026-03-12T00:20:00.000Z"));

      const live = await createYtMasterCall({
        deviceId: "driver-lock-4",
        reasonCode: "other",
        reasonDetailCode: "transshipment_done",
      });

      expect(live.currentCall).toMatchObject({
        reasonCode: "other",
        reasonDetailCode: "transshipment_done",
        reasonDetailLabel: "이적 끝",
        handlingMode: "message",
        status: "sent",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("hides a call from the master queue without archiving it", async () => {
    await saveYtMasterCallRegistration({
      deviceId: "master-8",
      role: "master",
      name: "Lee",
    });
    await saveYtMasterCallRegistration({
      deviceId: "driver-8",
      role: "driver",
      name: "Han",
      ytNumber: "630",
    });

    const liveAfterCreate = await createYtMasterCall({
      deviceId: "driver-8",
      reasonCode: "restroom",
    });
    const callId = liveAfterCreate.currentCall?.id;

    expect(callId).toBeTruthy();

    const hidden = await updateYtMasterCallVisibility(callId!, {
      deviceId: "master-8",
      action: "hide",
    });

    expect(hidden.call).toMatchObject({
      id: callId,
      hiddenByDeviceId: "master-8",
      archivedAt: null,
      archivedByDeviceId: null,
    });
    expect(hidden.call.hiddenAt).toEqual(expect.any(String));
    expect(hidden.liveState.queue).toEqual([]);
    expect(hidden.liveState.archives).toMatchObject({
      tractorInspection: [],
      other: [],
    });

    const driverLive = await getYtMasterCallLiveState("driver-8");
    expect(driverLive.currentCall).toMatchObject({
      id: callId,
      status: "pending",
    });
  });

  it("archives a tractor inspection call and restores it back to the master queue", async () => {
    await saveYtMasterCallRegistration({
      deviceId: "master-9",
      role: "master",
      name: "Lee",
    });
    await saveYtMasterCallRegistration({
      deviceId: "driver-9",
      role: "driver",
      name: "Choi",
      ytNumber: "631",
    });

    const liveAfterCreate = await createYtMasterCall({
      deviceId: "driver-9",
      reasonCode: "tractor_inspection",
      reasonDetailCode: "flat_tire",
    });
    const callId = liveAfterCreate.currentCall?.id;

    expect(callId).toBeTruthy();

    const archived = await updateYtMasterCallVisibility(callId!, {
      deviceId: "master-9",
      action: "archive",
    });

    expect(archived.call).toMatchObject({
      id: callId,
      archivedByDeviceId: "master-9",
      hiddenAt: null,
      hiddenByDeviceId: null,
    });
    expect(archived.call.archivedAt).toEqual(expect.any(String));
    expect(archived.liveState.queue).toEqual([]);
    expect(archived.liveState.archives.tractorInspection).toMatchObject([
      {
        id: callId,
        reasonCode: "tractor_inspection",
      },
    ]);

    const restored = await updateYtMasterCallVisibility(callId!, {
      deviceId: "master-9",
      action: "restore",
    });

    expect(restored.call).toMatchObject({
      id: callId,
      archivedAt: null,
      archivedByDeviceId: null,
    });
    expect(restored.liveState.queue).toMatchObject([
      {
        id: callId,
        reasonCode: "tractor_inspection",
      },
    ]);
    expect(restored.liveState.archives).toMatchObject({
      tractorInspection: [],
      other: [],
    });
  });

  it("rejects archiving restroom calls because they have no archive bin", async () => {
    await saveYtMasterCallRegistration({
      deviceId: "master-10",
      role: "master",
      name: "Lee",
    });
    await saveYtMasterCallRegistration({
      deviceId: "driver-10",
      role: "driver",
      name: "Kim",
      ytNumber: "632",
    });

    const liveAfterCreate = await createYtMasterCall({
      deviceId: "driver-10",
      reasonCode: "restroom",
    });
    const callId = liveAfterCreate.currentCall?.id;

    expect(callId).toBeTruthy();

    await expect(
      updateYtMasterCallVisibility(callId!, {
        deviceId: "master-10",
        action: "archive",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});
