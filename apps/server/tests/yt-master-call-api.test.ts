import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { clearYtMasterCallStateForTest } from "../src/services/ytMasterCall/store.js";

if (process.env.MODE !== "live" && process.env.MODE !== "fixture") {
  process.env.MODE = "fixture";
}

const createdApps: Array<Awaited<ReturnType<typeof Fastify>>> = [];

afterEach(async () => {
  while (createdApps.length) {
    const app = createdApps.pop();
    if (app) {
      await app.close();
    }
  }
  await clearYtMasterCallStateForTest();
});

describe("yt master call api", () => {
  it("creates and resolves a driver call with realtime broadcasts", async () => {
    const broadcasts: Array<{ eventName: string; payload: unknown }> = [];
    const app = Fastify();
    createdApps.push(app);

    const { registerRoutes } = await import("../src/routes/api.js");
    await registerRoutes(app, {
      repo: {} as any,
      monitorService: {} as any,
      sseHub: {
        broadcast(eventName: string, payload: unknown) {
          broadcasts.push({ eventName, payload });
        },
      } as any,
      cleanupService: {
        async runCleanupOnce() {
          return {};
        },
      } as any,
    });

    const registerMaster = await app.inject({
      method: "POST",
      url: "/api/yt-master-call/register",
      payload: {
        deviceId: "master-1",
        role: "master",
        name: "이영훈",
      },
    });
    expect(registerMaster.statusCode).toBe(200);

    const registerDriver = await app.inject({
      method: "POST",
      url: "/api/yt-master-call/register",
      payload: {
        deviceId: "driver-45",
        role: "driver",
        name: "김민수",
        ytNumber: "45",
      },
    });
    expect(registerDriver.statusCode).toBe(200);

    const createCall = await app.inject({
      method: "POST",
      url: "/api/yt-master-call/calls",
      payload: {
        deviceId: "driver-45",
        reasonCode: "tractor_inspection",
      },
    });
    expect(createCall.statusCode).toBe(200);
    expect(createCall.json()).toMatchObject({
      registration: {
        role: "driver",
      },
      currentCall: {
        driverName: "김민수",
        ytNumber: "YT-45",
        status: "pending",
      },
    });

    const duplicateCall = await app.inject({
      method: "POST",
      url: "/api/yt-master-call/calls",
      payload: {
        deviceId: "driver-45",
        reasonCode: "restroom",
      },
    });
    expect(duplicateCall.statusCode).toBe(409);

    const masterLiveBefore = await app.inject({
      method: "GET",
      url: "/api/yt-master-call/live?deviceId=master-1",
    });
    expect(masterLiveBefore.statusCode).toBe(200);
    expect(masterLiveBefore.json()).toMatchObject({
      registration: {
        role: "master",
        masterSlot: "MASTER-1",
      },
      pendingCount: 1,
      queue: [
        {
          driverName: "김민수",
          ytNumber: "YT-45",
          status: "pending",
        },
      ],
    });

    const callId = (createCall.json() as { currentCall?: { id?: string } }).currentCall?.id;
    expect(typeof callId).toBe("string");

    const approveCall = await app.inject({
      method: "POST",
      url: `/api/yt-master-call/calls/${callId}/decision`,
      payload: {
        deviceId: "master-1",
        status: "approved",
      },
    });
    expect(approveCall.statusCode).toBe(200);
    expect(approveCall.json()).toMatchObject({
      call: {
        id: callId,
        status: "approved",
        resolvedByName: "이영훈",
      },
    });

    const driverLiveAfter = await app.inject({
      method: "GET",
      url: "/api/yt-master-call/live?deviceId=driver-45",
    });
    expect(driverLiveAfter.statusCode).toBe(200);
    expect(driverLiveAfter.json()).toMatchObject({
      currentCall: {
        id: callId,
        status: "approved",
        resolvedByName: "이영훈",
      },
      pendingCount: 0,
    });

    expect(broadcasts.map((item) => item.eventName)).toEqual([
      "yt_master_call_role_updated",
      "yt_master_call_role_updated",
      "yt_master_call_changed",
      "yt_master_call_changed",
      "yt_master_call_resolved",
    ]);
    expect((broadcasts[4]?.payload as { driverDeviceId?: string })?.driverDeviceId).toBe("driver-45");
  });
});
