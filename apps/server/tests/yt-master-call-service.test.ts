import { afterEach, describe, expect, it } from "vitest";
import { clearYtMasterCallStateForTest } from "../src/services/ytMasterCall/store.js";
import {
  cancelYtMasterCall,
  clearYtMasterCallRegistration,
  createYtMasterCall,
  decideYtMasterCall,
  getYtMasterCallLiveState,
  saveYtMasterCallRegistration,
} from "../src/services/ytMasterCall/service.js";

afterEach(async () => {
  await clearYtMasterCallStateForTest();
});

describe("yt master call service", () => {
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

  it("stores emergency accident calls without tractor detail", async () => {
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
      status: "pending",
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

  it("acknowledges a message-only call, keeps an acknowledged driver state, and removes it from the master queue", async () => {
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
    expect(acknowledged.liveState.queue).toEqual([]);

    const driverLive = await getYtMasterCallLiveState("driver-6");
    expect(driverLive.currentCall).toMatchObject({
      id: callId,
      handlingMode: "message",
      status: "acknowledged",
      resolvedByName: "Park",
    });
    expect(driverLive.pendingCount).toBe(0);
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
});
