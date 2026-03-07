import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearYtWorkAutomationStateForTest } from "../src/services/ytWorkTime/automationStore.js";
import { clearYtWorkTimeRawStateForTest } from "../src/services/ytWorkTime/store.js";

if (process.env.MODE !== "live" && process.env.MODE !== "fixture") {
  process.env.MODE = "fixture";
}

const loadEquipmentLatestSnapshotMock = vi.fn();

vi.mock("../src/services/equipment/latestStore.js", () => ({
  loadEquipmentLatestSnapshot: loadEquipmentLatestSnapshotMock,
}));

const createdApps: Array<Awaited<ReturnType<typeof Fastify>>> = [];

function buildLatestSnapshot(capturedAt: string) {
  return {
    source: "gwct_equipment_status" as const,
    sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=D&s=A",
    capturedAt,
    ytCount: 1,
    ytKnown: 1,
    ytUnits: [
      {
        ytNo: "YT23",
        driverName: "Hong",
        loginTime: "03-07 10:00",
        hkName: null,
        stopReason: null,
        semanticState: "active" as const,
        fingerprint: `YT23:Hong:active:${capturedAt}`,
      },
    ],
    gcStates: [],
  };
}

describe.sequential("yt work-time automation api", () => {
  afterEach(async () => {
    while (createdApps.length) {
      const app = createdApps.pop();
      if (app) {
        await app.close();
      }
    }
    await clearYtWorkAutomationStateForTest();
    await clearYtWorkTimeRawStateForTest();
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("sets automation mode, reconciles immediately, and exposes the same automation state on GET", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-03-07T01:05:00.000Z"));
    loadEquipmentLatestSnapshotMock.mockResolvedValue(buildLatestSnapshot("2026-03-07T01:00:00.000Z"));

    const app = Fastify();
    createdApps.push(app);

    const { registerRoutes } = await import("../src/routes/api.js");
    await registerRoutes(app, {
      repo: {
        getRecentAlerts: async () => [],
      } as any,
      monitorService: {} as any,
      sseHub: { broadcast() {} } as any,
      cleanupService: {
        async runCleanupOnce() {
          return {};
        },
      } as any,
    });

    const post = await app.inject({
      method: "POST",
      url: "/api/yt/work-time/automation",
      payload: {
        mode: "full_auto",
      },
    });

    expect(post.statusCode).toBe(200);
    const postPayload = post.json() as {
      session: { mode: string; startedAt: string } | null;
      automation: { mode: string; status: string; nextStartAt: string | null; nextMode: string | null };
      latestYtCapturedAt: string | null;
      hasLiveSnapshot: boolean;
    };
    expect(postPayload.latestYtCapturedAt).toBe("2026-03-07T01:00:00.000Z");
    expect(postPayload.hasLiveSnapshot).toBe(true);
    expect(postPayload.session).toMatchObject({
      mode: "day",
      startedAt: "2026-03-07T01:00:00.000Z",
    });
    expect(postPayload.automation).toMatchObject({
      mode: "full_auto",
      status: "running",
      nextStartAt: "2026-03-07T09:45:00.000Z",
      nextMode: "night",
    });

    const get = await app.inject({
      method: "GET",
      url: "/api/yt/work-time",
    });

    expect(get.statusCode).toBe(200);
    const getPayload = get.json() as typeof postPayload;
    expect(getPayload.session).toMatchObject({
      mode: "day",
      startedAt: "2026-03-07T01:00:00.000Z",
    });
    expect(getPayload.automation).toMatchObject({
      mode: "full_auto",
      status: "running",
      nextStartAt: "2026-03-07T09:45:00.000Z",
      nextMode: "night",
    });
  });

  it("clears automation when manual shift start is requested", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-03-07T01:05:00.000Z"));
    loadEquipmentLatestSnapshotMock.mockResolvedValue(buildLatestSnapshot("2026-03-07T01:00:00.000Z"));

    const app = Fastify();
    createdApps.push(app);

    const { registerRoutes } = await import("../src/routes/api.js");
    await registerRoutes(app, {
      repo: {
        getRecentAlerts: async () => [],
      } as any,
      monitorService: {} as any,
      sseHub: { broadcast() {} } as any,
      cleanupService: {
        async runCleanupOnce() {
          return {};
        },
      } as any,
    });

    const auto = await app.inject({
      method: "POST",
      url: "/api/yt/work-time/automation",
      payload: {
        mode: "full_auto",
      },
    });
    expect(auto.statusCode).toBe(200);

    vi.setSystemTime(new Date("2026-03-07T01:10:00.000Z"));
    const manual = await app.inject({
      method: "POST",
      url: "/api/yt/work-time/start",
      payload: {
        mode: "day",
      },
    });

    expect(manual.statusCode).toBe(200);
    const payload = manual.json() as {
      session: { mode: string; startedAt: string } | null;
      automation: { mode: string; status: string };
    };
    expect(payload.automation).toMatchObject({
      mode: "off",
      status: "off",
    });
    expect(payload.session).toMatchObject({
      mode: "day",
      startedAt: "2026-03-07T01:10:00.000Z",
    });
  });
});
