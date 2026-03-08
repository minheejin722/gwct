import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
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

describe.sequential("yt work-time api", () => {
  afterEach(async () => {
    while (createdApps.length) {
      const app = createdApps.pop();
      if (app) {
        await app.close();
      }
    }
    await clearYtWorkTimeRawStateForTest();
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("auto-creates the current shift session from GET /api/yt/work-time", async () => {
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

    const response = await app.inject({
      method: "GET",
      url: "/api/yt/work-time",
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as {
      session: { mode: string; shiftWindowStartedAt: string; startedAt: string } | null;
      latestYtCapturedAt: string | null;
      hasLiveSnapshot: boolean;
    };

    expect(payload.latestYtCapturedAt).toBe("2026-03-07T01:00:00.000Z");
    expect(payload.hasLiveSnapshot).toBe(true);
    expect(payload.session).toMatchObject({
      mode: "day",
      shiftWindowStartedAt: "2026-03-06T21:45:00.000Z",
      startedAt: "2026-03-07T01:00:00.000Z",
    });
  });

  it("removes the old manual and automation POST endpoints", async () => {
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

    const manual = await app.inject({
      method: "POST",
      url: "/api/yt/work-time/start",
      payload: { mode: "day" },
    });
    const automation = await app.inject({
      method: "POST",
      url: "/api/yt/work-time/automation",
      payload: { mode: "full_auto" },
    });

    expect(manual.statusCode).toBe(404);
    expect(automation.statusCode).toBe(404);
  });
});
