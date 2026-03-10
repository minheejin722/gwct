import { afterEach, describe, expect, it } from "vitest";
import {
  clearYtMasterCallStateForTest,
} from "../src/services/ytMasterCall/store.js";
import {
  clearYtMasterCallRegistration,
  createYtMasterCall,
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
      name: "이영훈",
    });
    const masterTwo = await saveYtMasterCallRegistration({
      deviceId: "master-2",
      role: "master",
      name: "박반장",
    });

    expect(masterOne.registration?.masterSlot).toBe("MASTER-1");
    expect(masterTwo.registration?.masterSlot).toBe("MASTER-2");

    await expect(
      saveYtMasterCallRegistration({
        deviceId: "master-3",
        role: "master",
        name: "최반장",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("blocks driver role clear while a pending call exists", async () => {
    await saveYtMasterCallRegistration({
      deviceId: "driver-1",
      role: "driver",
      name: "김민수",
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
});
