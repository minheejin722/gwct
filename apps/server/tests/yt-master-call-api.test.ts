import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearYtMasterCallStateForTest } from "../src/services/ytMasterCall/store.js";

process.env.YT_MASTER_CALL_STATE_FILE = "yt_master_call_state.api.test.json";

if (process.env.MODE !== "live" && process.env.MODE !== "fixture") {
  process.env.MODE = "fixture";
}

const createdApps: Array<Awaited<ReturnType<typeof Fastify>>> = [];

beforeEach(async () => {
  await clearYtMasterCallStateForTest();
});

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
    const pushed: Array<Record<string, unknown>> = [];
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
      notificationService: {
        async dispatchToDeviceIds(input: Record<string, unknown>) {
          pushed.push(input);
        },
      } as any,
    });

    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/yt-master-call/register",
          payload: {
            deviceId: "master-1",
            role: "master",
            name: "Lee",
          },
        })
      ).statusCode,
    ).toBe(200);

    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/yt-master-call/register",
          payload: {
            deviceId: "driver-45",
            role: "driver",
            name: "Kim",
            ytNumber: "45",
          },
        })
      ).statusCode,
    ).toBe(200);

    const createCall = await app.inject({
      method: "POST",
      url: "/api/yt-master-call/calls",
      payload: {
        deviceId: "driver-45",
        reasonCode: "tractor_inspection",
        reasonDetailCode: "flat_tire",
      },
    });
    expect(createCall.statusCode).toBe(200);
    expect(createCall.json()).toMatchObject({
      registration: {
        role: "driver",
      },
      currentCall: {
        driverName: "Kim",
        ytNumber: "YT-45",
        reasonDetailCode: "flat_tire",
        reasonDetailLabel: "타이어 펑크",
        status: "pending",
      },
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
        resolvedByName: "Lee",
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
        resolvedByName: "Lee",
      },
      pendingCount: 0,
    });
    expect(pushed).toHaveLength(2);
    expect(pushed[0]).toMatchObject({
      eventType: "yt_master_call_created",
      deepLink: "yt-master-call",
      deviceIds: ["master-1"],
      forcePresentation: true,
      autoOpen: true,
      entityKey: callId,
      body: "YT-45 Kim 트랙터 점검 · 타이어 펑크",
    });
    expect(pushed[1]).toMatchObject({
      eventType: "yt_master_call_approved",
      deepLink: "yt-master-call",
      deviceIds: ["driver-45"],
      forcePresentation: true,
      autoOpen: true,
      entityKey: callId,
    });

    expect(broadcasts.map((item) => item.eventName)).toEqual([
      "yt_master_call_role_updated",
      "yt_master_call_role_updated",
      "yt_master_call_changed",
      "yt_master_call_changed",
      "yt_master_call_resolved",
    ]);
  });

  it("cancels a pending driver call and removes it from the master queue", async () => {
    const broadcasts: Array<{ eventName: string; payload: unknown }> = [];
    const pushed: Array<Record<string, unknown>> = [];
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
      notificationService: {
        async dispatchToDeviceIds(input: Record<string, unknown>) {
          pushed.push(input);
        },
      } as any,
    });

    await app.inject({
      method: "POST",
      url: "/api/yt-master-call/register",
      payload: {
        deviceId: "master-1",
        role: "master",
        name: "Lee",
      },
    });

    await app.inject({
      method: "POST",
      url: "/api/yt-master-call/register",
      payload: {
        deviceId: "driver-18",
        role: "driver",
        name: "Han",
        ytNumber: "18",
      },
    });

    const createCall = await app.inject({
      method: "POST",
      url: "/api/yt-master-call/calls",
      payload: {
        deviceId: "driver-18",
        reasonCode: "restroom",
      },
    });
    const callId = (createCall.json() as { currentCall?: { id?: string } }).currentCall?.id;

    const masterLiveBefore = await app.inject({
      method: "GET",
      url: "/api/yt-master-call/live?deviceId=master-1",
    });
    expect(masterLiveBefore.json()).toMatchObject({
      pendingCount: 1,
      queue: [
        {
          id: callId,
          status: "pending",
        },
      ],
    });

    const cancelCall = await app.inject({
      method: "DELETE",
      url: `/api/yt-master-call/calls/${callId}`,
      payload: {
        deviceId: "driver-18",
      },
    });
    expect(cancelCall.statusCode).toBe(200);
    expect(cancelCall.json()).toMatchObject({
      call: {
        id: callId,
        status: "cancelled",
      },
      liveState: {
        currentCall: null,
        pendingCount: 0,
      },
    });

    const masterLiveAfter = await app.inject({
      method: "GET",
      url: "/api/yt-master-call/live?deviceId=master-1",
    });
    expect(masterLiveAfter.json()).toMatchObject({
      pendingCount: 0,
      queue: [],
    });

    expect(broadcasts.map((item) => item.eventName)).toEqual([
      "yt_master_call_role_updated",
      "yt_master_call_role_updated",
      "yt_master_call_changed",
      "yt_master_call_changed",
    ]);
    expect((broadcasts[3]?.payload as { type?: string; status?: string })?.type).toBe("cancelled");
    expect((broadcasts[3]?.payload as { type?: string; status?: string })?.status).toBe("cancelled");
    expect(pushed).toHaveLength(1);
    expect(pushed[0]).toMatchObject({
      eventType: "yt_master_call_created",
      deepLink: "yt-master-call",
      deviceIds: ["master-1"],
      forcePresentation: true,
      autoOpen: true,
      entityKey: callId,
    });
  });

  it("pushes emergency accident as a message-only call to masters with the emergency label", async () => {
    const pushed: Array<Record<string, unknown>> = [];
    const app = Fastify();
    createdApps.push(app);

    const { registerRoutes } = await import("../src/routes/api.js");
    await registerRoutes(app, {
      repo: {} as any,
      monitorService: {} as any,
      sseHub: {
        broadcast() {},
      } as any,
      cleanupService: {
        async runCleanupOnce() {
          return {};
        },
      } as any,
      notificationService: {
        async dispatchToDeviceIds(input: Record<string, unknown>) {
          pushed.push(input);
        },
      } as any,
    });

    await app.inject({
      method: "POST",
      url: "/api/yt-master-call/register",
      payload: {
        deviceId: "master-1",
        role: "master",
        name: "Lee",
      },
    });

    await app.inject({
      method: "POST",
      url: "/api/yt-master-call/register",
      payload: {
        deviceId: "driver-77",
        role: "driver",
        name: "Kim",
        ytNumber: "77",
      },
    });

    const createCall = await app.inject({
      method: "POST",
      url: "/api/yt-master-call/calls",
      payload: {
        deviceId: "driver-77",
        reasonCode: "emergency_accident",
      },
    });

    expect(createCall.statusCode).toBe(200);
    expect(createCall.json()).toMatchObject({
      currentCall: {
        ytNumber: "YT-77",
        reasonCode: "emergency_accident",
        reasonLabel: "긴급 사고",
        reasonDetailCode: null,
        reasonDetailLabel: null,
        handlingMode: "message",
        status: "sent",
      },
    });

    const callId = (createCall.json() as { currentCall?: { id?: string } }).currentCall?.id;
    expect(callId).toBeTruthy();

    expect(pushed).toHaveLength(1);
    expect(pushed[0]).toMatchObject({
      eventType: "yt_master_call_created",
      deepLink: "yt-master-call",
      deviceIds: ["master-1"],
      forcePresentation: true,
      autoOpen: true,
      entityKey: callId,
      body: "YT-77 Kim 긴급 사고",
    });
  });

  it("creates a message-only tractor detail call for master confirmation", async () => {
    const pushed: Array<Record<string, unknown>> = [];
    const app = Fastify();
    createdApps.push(app);

    const { registerRoutes } = await import("../src/routes/api.js");
    await registerRoutes(app, {
      repo: {} as any,
      monitorService: {} as any,
      sseHub: {
        broadcast() {},
      } as any,
      cleanupService: {
        async runCleanupOnce() {
          return {};
        },
      } as any,
      notificationService: {
        async dispatchToDeviceIds(input: Record<string, unknown>) {
          pushed.push(input);
        },
      } as any,
    });

    await app.inject({
      method: "POST",
      url: "/api/yt-master-call/register",
      payload: {
        deviceId: "master-tractor-message",
        role: "master",
        name: "Lee",
      },
    });

    await app.inject({
      method: "POST",
      url: "/api/yt-master-call/register",
      payload: {
        deviceId: "driver-tractor-message",
        role: "driver",
        name: "Kim",
        ytNumber: "88",
      },
    });

    const createCall = await app.inject({
      method: "POST",
      url: "/api/yt-master-call/calls",
      payload: {
        deviceId: "driver-tractor-message",
        reasonCode: "tractor_inspection",
        reasonDetailCode: "wheel_detached",
      },
    });

    expect(createCall.statusCode).toBe(200);
    expect(createCall.json()).toMatchObject({
      currentCall: {
        ytNumber: "YT-88",
        reasonCode: "tractor_inspection",
        reasonDetailCode: "wheel_detached",
        reasonDetailLabel: "바퀴 빠짐",
        handlingMode: "message",
        status: "sent",
      },
    });

    const callId = (createCall.json() as { currentCall?: { id?: string } }).currentCall?.id;
    expect(callId).toBeTruthy();

    expect(pushed).toHaveLength(1);
    expect(pushed[0]).toMatchObject({
      eventType: "yt_master_call_created",
      deepLink: "yt-master-call",
      deviceIds: ["master-tractor-message"],
      forcePresentation: true,
      autoOpen: true,
      entityKey: callId,
      body: "YT-88 Kim 트랙터 점검 · 바퀴 빠짐",
    });
  });

  it("pushes a detailed other call with the selected other detail label", async () => {
    const pushed: Array<Record<string, unknown>> = [];
    const app = Fastify();
    createdApps.push(app);

    const { registerRoutes } = await import("../src/routes/api.js");
    await registerRoutes(app, {
      repo: {} as any,
      monitorService: {} as any,
      sseHub: {
        broadcast() {},
      } as any,
      cleanupService: {
        async runCleanupOnce() {
          return {};
        },
      } as any,
      notificationService: {
        async dispatchToDeviceIds(input: Record<string, unknown>) {
          pushed.push(input);
        },
      } as any,
    });

    await app.inject({
      method: "POST",
      url: "/api/yt-master-call/register",
      payload: {
        deviceId: "master-1",
        role: "master",
        name: "Lee",
      },
    });

    await app.inject({
      method: "POST",
      url: "/api/yt-master-call/register",
      payload: {
        deviceId: "driver-46",
        role: "driver",
        name: "Kim",
        ytNumber: "46",
      },
    });

    const createCall = await app.inject({
      method: "POST",
      url: "/api/yt-master-call/calls",
      payload: {
        deviceId: "driver-46",
        reasonCode: "other",
        reasonDetailCode: "gc181_cabin_report",
      },
    });

    expect(createCall.statusCode).toBe(200);
    expect(createCall.json()).toMatchObject({
      currentCall: {
        ytNumber: "YT-46",
        reasonCode: "other",
        reasonLabel: "기타 사유",
        reasonDetailCode: "gc181_cabin_report",
        reasonDetailLabel: "GC181 고발",
        handlingMode: "message",
        status: "sent",
      },
    });

    const callId = (createCall.json() as { currentCall?: { id?: string } }).currentCall?.id;
    expect(callId).toBeTruthy();

    expect(pushed).toHaveLength(1);
    expect(pushed[0]).toMatchObject({
      eventType: "yt_master_call_created",
      deepLink: "yt-master-call",
      deviceIds: ["master-1"],
      forcePresentation: true,
      autoOpen: true,
      entityKey: callId,
      body: "YT-46 Kim 기타 사유 · GC181 고발",
    });
  });

  it("creates a day-off schedule other call with the selected date in the payload and push text", async () => {
    const pushed: Array<Record<string, unknown>> = [];
    const app = Fastify();
    createdApps.push(app);

    const { registerRoutes } = await import("../src/routes/api.js");
    await registerRoutes(app, {
      repo: {} as any,
      monitorService: {} as any,
      sseHub: {
        broadcast() {},
      } as any,
      cleanupService: {
        async runCleanupOnce() {
          return {};
        },
      } as any,
      notificationService: {
        async dispatchToDeviceIds(input: Record<string, unknown>) {
          pushed.push(input);
        },
      } as any,
    });

    await app.inject({
      method: "POST",
      url: "/api/yt-master-call/register",
      payload: {
        deviceId: "master-dayoff-1",
        role: "master",
        name: "Lee",
      },
    });

    await app.inject({
      method: "POST",
      url: "/api/yt-master-call/register",
      payload: {
        deviceId: "driver-dayoff-1",
        role: "driver",
        name: "Kim",
        ytNumber: "48",
      },
    });

    const createCall = await app.inject({
      method: "POST",
      url: "/api/yt-master-call/calls",
      payload: {
        deviceId: "driver-dayoff-1",
        reasonCode: "other",
        reasonDetailCode: "day_off_schedule",
        reasonDetailValue: "2026-03-25",
      },
    });

    expect(createCall.statusCode).toBe(200);
    expect(createCall.json()).toMatchObject({
      currentCall: {
        reasonCode: "other",
        reasonDetailCode: "day_off_schedule",
        reasonDetailLabel: "휴무일정 03.25",
        reasonDetailValue: "2026-03-25",
        handlingMode: "decision",
        status: "pending",
      },
    });

    expect(pushed).toHaveLength(1);
    expect(pushed[0]).toMatchObject({
      eventType: "yt_master_call_created",
      body: "YT-48 Kim 기타 사유 · 휴무일정 03.25",
      raw: {
        reasonDetailCode: "day_off_schedule",
        reasonDetailLabel: "휴무일정 03.25",
        reasonDetailValue: "2026-03-25",
      },
    });
  });

  it("creates a multi-date day-off schedule payload and push text", async () => {
    const pushed: Array<Record<string, unknown>> = [];
    const app = Fastify();
    createdApps.push(app);

    const { registerRoutes } = await import("../src/routes/api.js");
    await registerRoutes(app, {
      repo: {} as any,
      monitorService: {} as any,
      sseHub: {
        broadcast() {},
      } as any,
      cleanupService: {
        async runCleanupOnce() {
          return {};
        },
      } as any,
      notificationService: {
        async dispatchToDeviceIds(input: Record<string, unknown>) {
          pushed.push(input);
        },
      } as any,
    });

    await app.inject({
      method: "POST",
      url: "/api/yt-master-call/register",
      payload: {
        deviceId: "master-dayoff-2",
        role: "master",
        name: "Lee",
      },
    });

    await app.inject({
      method: "POST",
      url: "/api/yt-master-call/register",
      payload: {
        deviceId: "driver-dayoff-2",
        role: "driver",
        name: "Kim",
        ytNumber: "49",
      },
    });

    const createCall = await app.inject({
      method: "POST",
      url: "/api/yt-master-call/calls",
      payload: {
        deviceId: "driver-dayoff-2",
        reasonCode: "other",
        reasonDetailCode: "day_off_schedule",
        reasonDetailValue: "2026-03-25,2026-03-26,2026-03-27,2026-04-02",
      },
    });

    expect(createCall.statusCode).toBe(200);
    expect(createCall.json()).toMatchObject({
      currentCall: {
        reasonCode: "other",
        reasonDetailCode: "day_off_schedule",
        reasonDetailLabel: "휴무일정 03.25~03.27, 04.02",
        reasonDetailValue: "2026-03-25,2026-03-26,2026-03-27,2026-04-02",
        handlingMode: "decision",
        status: "pending",
      },
    });

    expect(pushed).toHaveLength(1);
    expect(pushed[0]).toMatchObject({
      eventType: "yt_master_call_created",
      body: "YT-49 Kim 기타 사유 · 휴무일정 03.25~03.27, 04.02",
      raw: {
        reasonDetailCode: "day_off_schedule",
        reasonDetailLabel: "휴무일정 03.25~03.27, 04.02",
        reasonDetailValue: "2026-03-25,2026-03-26,2026-03-27,2026-04-02",
      },
    });
  });

  it("acknowledges a message-only call, notifies the driver, and keeps it visible in the master queue", async () => {
    const broadcasts: Array<{ eventName: string; payload: unknown }> = [];
    const pushed: Array<Record<string, unknown>> = [];
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
      notificationService: {
        async dispatchToDeviceIds(input: Record<string, unknown>) {
          pushed.push(input);
        },
      } as any,
    });

    await app.inject({
      method: "POST",
      url: "/api/yt-master-call/register",
      payload: {
        deviceId: "master-7",
        role: "master",
        name: "Lee",
      },
    });

    await app.inject({
      method: "POST",
      url: "/api/yt-master-call/register",
      payload: {
        deviceId: "driver-47",
        role: "driver",
        name: "Kim",
        ytNumber: "47",
      },
    });

    const createCall = await app.inject({
      method: "POST",
      url: "/api/yt-master-call/calls",
      payload: {
        deviceId: "driver-47",
        reasonCode: "other",
        reasonDetailCode: "suggestion",
      },
    });

    expect(createCall.statusCode).toBe(200);
    expect(createCall.json()).toMatchObject({
      currentCall: {
        handlingMode: "message",
        status: "sent",
        reasonDetailCode: "suggestion",
        reasonDetailLabel: "건의사항",
      },
    });

    const callId = (createCall.json() as { currentCall?: { id?: string } }).currentCall?.id;
    expect(callId).toBeTruthy();

    const acknowledgeCall = await app.inject({
      method: "POST",
      url: `/api/yt-master-call/calls/${callId}/decision`,
      payload: {
        deviceId: "master-7",
        status: "acknowledged",
      },
    });

    expect(acknowledgeCall.statusCode).toBe(200);
    expect(acknowledgeCall.json()).toMatchObject({
      call: {
        id: callId,
        status: "acknowledged",
        handlingMode: "message",
        resolvedByName: "Lee",
      },
    });

    const driverLiveAfter = await app.inject({
      method: "GET",
      url: "/api/yt-master-call/live?deviceId=driver-47",
    });
    expect(driverLiveAfter.statusCode).toBe(200);
    expect(driverLiveAfter.json()).toMatchObject({
      currentCall: {
        id: callId,
        status: "acknowledged",
        handlingMode: "message",
        resolvedByName: "Lee",
      },
      pendingCount: 0,
    });

    const masterLiveAfter = await app.inject({
      method: "GET",
      url: "/api/yt-master-call/live?deviceId=master-7",
    });
    expect(masterLiveAfter.statusCode).toBe(200);
    expect(masterLiveAfter.json()).toMatchObject({
      queue: [
        {
          id: callId,
          status: "acknowledged",
          handlingMode: "message",
          resolvedByName: "Lee",
        },
      ],
      pendingCount: 0,
    });

    expect(pushed).toHaveLength(2);
    expect(pushed[0]).toMatchObject({
      eventType: "yt_master_call_created",
      deviceIds: ["master-7"],
      entityKey: callId,
    });
    expect(pushed[1]).toMatchObject({
      eventType: "yt_master_call_acknowledged",
      deepLink: "yt-master-call",
      deviceIds: ["driver-47"],
      forcePresentation: true,
      autoOpen: true,
      entityKey: callId,
      title: "메시지 확인",
      body: "YT-47 Kim 메시지가 확인되었습니다.",
    });

    expect(broadcasts.map((item) => item.eventName)).toEqual([
      "yt_master_call_role_updated",
      "yt_master_call_role_updated",
      "yt_master_call_changed",
      "yt_master_call_changed",
      "yt_master_call_resolved",
    ]);
    expect((broadcasts[3]?.payload as { type?: string; status?: string })?.type).toBe("acknowledged");
    expect((broadcasts[3]?.payload as { type?: string; status?: string })?.status).toBe("acknowledged");
    expect((broadcasts[4]?.payload as { status?: string; title?: string; message?: string })?.status).toBe("acknowledged");
    expect((broadcasts[4]?.payload as { status?: string; title?: string; message?: string })?.title).toBe("메시지 확인");
    expect((broadcasts[4]?.payload as { status?: string; title?: string; message?: string })?.message).toBe(
      "YT-47 Kim 메시지가 확인되었습니다.",
    );
  });

  it("archives and restores a tractor inspection call through the visibility route", async () => {
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
      notificationService: {
        async dispatchToDeviceIds() {
          return;
        },
      } as any,
    });

    await app.inject({
      method: "POST",
      url: "/api/yt-master-call/register",
      payload: {
        deviceId: "master-9",
        role: "master",
        name: "Lee",
      },
    });

    await app.inject({
      method: "POST",
      url: "/api/yt-master-call/register",
      payload: {
        deviceId: "driver-49",
        role: "driver",
        name: "Kim",
        ytNumber: "49",
      },
    });

    const createCall = await app.inject({
      method: "POST",
      url: "/api/yt-master-call/calls",
      payload: {
        deviceId: "driver-49",
        reasonCode: "tractor_inspection",
        reasonDetailCode: "flat_tire",
      },
    });
    const callId = (createCall.json() as { currentCall?: { id?: string } }).currentCall?.id;

    expect(callId).toBeTruthy();

    const archiveCall = await app.inject({
      method: "POST",
      url: `/api/yt-master-call/calls/${callId}/visibility`,
      payload: {
        deviceId: "master-9",
        action: "archive",
      },
    });

    expect(archiveCall.statusCode).toBe(200);
    expect(archiveCall.json()).toMatchObject({
      call: {
        id: callId,
        archivedByDeviceId: "master-9",
        hiddenAt: null,
        hiddenByDeviceId: null,
      },
      liveState: {
        queue: [],
        archives: {
          tractorInspection: [
            {
              id: callId,
              reasonCode: "tractor_inspection",
            },
          ],
          other: [],
        },
      },
    });

    const restoreCall = await app.inject({
      method: "POST",
      url: `/api/yt-master-call/calls/${callId}/visibility`,
      payload: {
        deviceId: "master-9",
        action: "restore",
      },
    });

    expect(restoreCall.statusCode).toBe(200);
    expect(restoreCall.json()).toMatchObject({
      call: {
        id: callId,
        archivedAt: null,
        archivedByDeviceId: null,
      },
      liveState: {
        queue: [
          {
            id: callId,
            reasonCode: "tractor_inspection",
          },
        ],
        archives: {
          tractorInspection: [],
          other: [],
        },
      },
    });

    const masterLiveAfter = await app.inject({
      method: "GET",
      url: "/api/yt-master-call/live?deviceId=master-9",
    });
    expect(masterLiveAfter.statusCode).toBe(200);
    expect(masterLiveAfter.json()).toMatchObject({
      queue: [
        {
          id: callId,
        },
      ],
      archives: {
        tractorInspection: [],
        other: [],
      },
    });

    expect(broadcasts.map((item) => item.eventName)).toEqual([
      "yt_master_call_role_updated",
      "yt_master_call_role_updated",
      "yt_master_call_changed",
      "yt_master_call_changed",
      "yt_master_call_changed",
    ]);
    expect((broadcasts[3]?.payload as { type?: string })?.type).toBe("archive");
    expect((broadcasts[4]?.payload as { type?: string })?.type).toBe("restore");
  });

  it("rejects archiving restroom calls and allows hiding them through the visibility route", async () => {
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
      notificationService: {
        async dispatchToDeviceIds() {
          return;
        },
      } as any,
    });

    await app.inject({
      method: "POST",
      url: "/api/yt-master-call/register",
      payload: {
        deviceId: "master-10",
        role: "master",
        name: "Lee",
      },
    });

    await app.inject({
      method: "POST",
      url: "/api/yt-master-call/register",
      payload: {
        deviceId: "driver-50",
        role: "driver",
        name: "Han",
        ytNumber: "50",
      },
    });

    const createCall = await app.inject({
      method: "POST",
      url: "/api/yt-master-call/calls",
      payload: {
        deviceId: "driver-50",
        reasonCode: "restroom",
      },
    });
    const callId = (createCall.json() as { currentCall?: { id?: string } }).currentCall?.id;

    expect(callId).toBeTruthy();

    const rejectedArchive = await app.inject({
      method: "POST",
      url: `/api/yt-master-call/calls/${callId}/visibility`,
      payload: {
        deviceId: "master-10",
        action: "archive",
      },
    });

    expect(rejectedArchive.statusCode).toBe(409);

    const hideCall = await app.inject({
      method: "POST",
      url: `/api/yt-master-call/calls/${callId}/visibility`,
      payload: {
        deviceId: "master-10",
        action: "hide",
      },
    });

    expect(hideCall.statusCode).toBe(200);
    expect(hideCall.json()).toMatchObject({
      call: {
        id: callId,
        hiddenByDeviceId: "master-10",
        archivedAt: null,
        archivedByDeviceId: null,
      },
      liveState: {
        queue: [],
        archives: {
          tractorInspection: [],
          other: [],
        },
      },
    });

    const masterLiveAfter = await app.inject({
      method: "GET",
      url: "/api/yt-master-call/live?deviceId=master-10",
    });
    expect(masterLiveAfter.statusCode).toBe(200);
    expect(masterLiveAfter.json()).toMatchObject({
      queue: [],
      archives: {
        tractorInspection: [],
        other: [],
      },
    });

    expect(broadcasts.map((item) => item.eventName)).toEqual([
      "yt_master_call_role_updated",
      "yt_master_call_role_updated",
      "yt_master_call_changed",
      "yt_master_call_changed",
    ]);
    expect((broadcasts[3]?.payload as { type?: string })?.type).toBe("hide");
  });

  it("creates container protrusion as a message-only call for masters", async () => {
    const pushed: Array<Record<string, unknown>> = [];
    const app = Fastify();
    createdApps.push(app);

    const { registerRoutes } = await import("../src/routes/api.js");
    await registerRoutes(app, {
      repo: {} as any,
      monitorService: {} as any,
      sseHub: {
        broadcast() {},
      } as any,
      cleanupService: {
        async runCleanupOnce() {
          return {};
        },
      } as any,
      notificationService: {
        async dispatchToDeviceIds(input: Record<string, unknown>) {
          pushed.push(input);
        },
      } as any,
    });

    await app.inject({
      method: "POST",
      url: "/api/yt-master-call/register",
      payload: {
        deviceId: "master-8",
        role: "master",
        name: "Lee",
      },
    });

    const driverRegister = await app.inject({
      method: "POST",
      url: "/api/yt-master-call/register",
      payload: {
        deviceId: "driver-48",
        role: "driver",
        name: "Kim",
        ytNumber: "48",
      },
    });
    expect(driverRegister.statusCode).toBe(200);

    const createCall = await app.inject({
      method: "POST",
      url: "/api/yt-master-call/calls",
      payload: {
        deviceId: "driver-48",
        reasonCode: "other",
        reasonDetailCode: "yard_container_first_lane_first_tier_protrusion",
      },
    });

    expect(createCall.statusCode).toBe(200);
    expect(createCall.json()).toMatchObject({
      currentCall: {
        reasonCode: "other",
        reasonDetailCode: "yard_container_first_lane_first_tier_protrusion",
        reasonDetailLabel: "컨테이너 돌출",
        handlingMode: "message",
        status: "sent",
      },
    });

    const callId = (createCall.json() as { currentCall?: { id?: string } }).currentCall?.id;
    expect(callId).toBeTruthy();

    expect(pushed).toHaveLength(1);
    expect(pushed[0]).toMatchObject({
      eventType: "yt_master_call_created",
      deviceIds: ["master-8"],
      entityKey: callId,
      body: "YT-48 Kim 기타 사유 · 컨테이너 돌출",
    });
  });

  it("blocks duplicate locked other reasons within twenty minutes at the api layer", async () => {
    const pushed: Array<Record<string, unknown>> = [];
    const app = Fastify();
    createdApps.push(app);

    const { registerRoutes } = await import("../src/routes/api.js");
    await registerRoutes(app, {
      repo: {} as any,
      monitorService: {} as any,
      sseHub: {
        broadcast() {},
      } as any,
      cleanupService: {
        async runCleanupOnce() {
          return {};
        },
      } as any,
      notificationService: {
        async dispatchToDeviceIds(input: Record<string, unknown>) {
          pushed.push(input);
        },
      },
    });

    await app.inject({
      method: "POST",
      url: "/api/yt-master-call/register",
      payload: {
        deviceId: "master-lock-1",
        role: "master",
        name: "Lee",
      },
    });

    await app.inject({
      method: "POST",
      url: "/api/yt-master-call/register",
      payload: {
        deviceId: "driver-lock-1",
        role: "driver",
        name: "Kim",
        ytNumber: "650",
      },
    });

    await app.inject({
      method: "POST",
      url: "/api/yt-master-call/register",
      payload: {
        deviceId: "driver-lock-2",
        role: "driver",
        name: "Park",
        ytNumber: "651",
      },
    });

    const firstCreate = await app.inject({
      method: "POST",
      url: "/api/yt-master-call/calls",
      payload: {
        deviceId: "driver-lock-1",
        reasonCode: "other",
        reasonDetailCode: "lunch_shuttle",
      },
    });

    expect(firstCreate.statusCode).toBe(200);

    const secondCreate = await app.inject({
      method: "POST",
      url: "/api/yt-master-call/calls",
      payload: {
        deviceId: "driver-lock-2",
        reasonCode: "other",
        reasonDetailCode: "lunch_shuttle",
      },
    });

    expect(secondCreate.statusCode).toBe(409);
    expect(secondCreate.json()).toEqual({
      error: "같은 사유로 이미 메세지가 도달했습니다.",
    });
    expect(pushed).toHaveLength(1);
  });
});
