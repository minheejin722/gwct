import Fastify from "fastify";
import type { EquipmentLoginStatus, YTUnitSnapshot } from "@gwct/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearYtWorkTimeRawStateForTest } from "../src/services/ytWorkTime/store.js";

if (process.env.MODE !== "live" && process.env.MODE !== "fixture") {
  process.env.MODE = "fixture";
}

const loadEquipmentLatestSnapshotMock = vi.fn();

vi.mock("../src/services/equipment/latestStore.js", () => ({
  loadEquipmentLatestSnapshot: loadEquipmentLatestSnapshotMock,
}));

const createdApps: Array<Awaited<ReturnType<typeof Fastify>>> = [];

function equipmentRow(
  seenAt: string,
  equipmentId: string,
  operatorName: string | null,
  stopReason: string | null = null,
): EquipmentLoginStatus {
  return {
    source: "gwct_equipment_status",
    equipmentId,
    operatorName,
    helperName: null,
    loginText: null,
    stopReason,
    signature: `${equipmentId}:${operatorName || "-"}:${stopReason || "-"}:${seenAt}`,
    seenAt,
  };
}

function buildLatestSnapshot(
  capturedAt: string,
  ytUnits: YTUnitSnapshot[] = [
    {
      ytNo: "YT23",
      driverName: "Hong",
      loginTime: "03-07 10:00",
      logoutTime: null,
      hkName: null,
      stopReason: null,
      semanticState: "active" as const,
      fingerprint: `YT23:Hong:active:${capturedAt}`,
    },
  ],
) {
  return {
    source: "gwct_equipment_status" as const,
    sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=D&s=A",
    capturedAt,
    ytCount: ytUnits.filter((unit) => unit.semanticState === "active").length,
    ytKnown: ytUnits.length,
    ytUnits,
    gcStates: [],
  };
}

describe.sequential("yt work-time api", () => {
  beforeEach(async () => {
    await clearYtWorkTimeRawStateForTest();
  });

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
        getEquipmentStatusSnapshotGroupsSince: async () => [],
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
      shiftStatus: { state: string; reason: string; mode: string | null; label: string; detail: string | null };
    };

    expect(payload.latestYtCapturedAt).toBe("2026-03-07T01:00:00.000Z");
    expect(payload.hasLiveSnapshot).toBe(true);
    expect(payload.session).toMatchObject({
      mode: "day",
      shiftWindowStartedAt: "2026-03-06T21:45:00.000Z",
      startedAt: "2026-03-07T01:00:00.000Z",
    });
    expect(payload.shiftStatus).toMatchObject({
      state: "collecting",
      reason: "active_shift",
      mode: "day",
      label: "집계중",
    });
  });

  it("returns a paused team-off indicator after the grace window if no YT is logged in", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-03-06T22:20:00.000Z"));
    loadEquipmentLatestSnapshotMock.mockResolvedValue(
      buildLatestSnapshot("2026-03-06T22:20:00.000Z", [
        {
          ytNo: "YT23",
          driverName: null,
          loginTime: null,
          logoutTime: null,
          hkName: null,
          stopReason: null,
          semanticState: "logged_out" as const,
          fingerprint: "YT23:-:logged_out:2026-03-06T22:20:00.000Z",
        },
      ]),
    );

    const app = Fastify();
    createdApps.push(app);

    const { registerRoutes } = await import("../src/routes/api.js");
    await registerRoutes(app, {
      repo: {
        getRecentAlerts: async () => [],
        getEquipmentStatusSnapshotGroupsSince: async () => [],
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
      shiftStatus: { state: string; reason: string; mode: string | null; label: string; detail: string | null };
      session: { drivers: Array<unknown> } | null;
    };

    expect(payload.shiftStatus).toMatchObject({
      state: "paused",
      reason: "team_off",
      mode: "day",
      label: "일시 정지",
    });
    expect(payload.session?.drivers).toHaveLength(0);
  });

  it("rebuilds the current shift session from equipment history during the meal break instead of returning an empty list", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-03-07T15:15:00.000Z")); // 00:15 KST
    loadEquipmentLatestSnapshotMock.mockResolvedValue(
      buildLatestSnapshot("2026-03-07T15:05:00.000Z", [
        {
          ytNo: "YT23",
          driverName: "Hong",
          loginTime: "03-07 23:50",
          logoutTime: null,
          hkName: null,
          stopReason: "식사",
          semanticState: "stopped" as const,
          fingerprint: "YT23:Hong:stopped:2026-03-07T15:05:00.000Z",
        },
      ]),
    );

    const app = Fastify();
    createdApps.push(app);

    const { registerRoutes } = await import("../src/routes/api.js");
    await registerRoutes(app, {
      repo: {
        getRecentAlerts: async () => [],
        getEquipmentStatusSnapshotGroupsSince: async () => [
          {
            seenAt: "2026-03-07T14:50:00.000Z",
            items: [equipmentRow("2026-03-07T14:50:00.000Z", "YT23", "Hong")],
          },
          {
            seenAt: "2026-03-07T15:05:00.000Z",
            items: [equipmentRow("2026-03-07T15:05:00.000Z", "YT23", "Hong", "식사")],
          },
        ],
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
      shiftStatus: { state: string; reason: string; mode: string | null; label: string; detail: string | null };
      session: {
        drivers: Array<{ driverName: string; totalWorkedMinutes: number; latestState: string }>;
      } | null;
    };

    expect(payload.shiftStatus).toMatchObject({
      state: "paused",
      reason: "break_time",
      mode: "night",
      label: "일시 정지",
    });
    expect(payload.session?.drivers).toHaveLength(1);
    expect(payload.session?.drivers[0]).toMatchObject({
      driverName: "Hong",
      latestState: "stopped",
      totalWorkedMinutes: 10,
    });
  });

  it("removes the old manual and automation POST endpoints", async () => {
    const app = Fastify();
    createdApps.push(app);

    const { registerRoutes } = await import("../src/routes/api.js");
    await registerRoutes(app, {
      repo: {
        getRecentAlerts: async () => [],
        getEquipmentStatusSnapshotGroupsSince: async () => [],
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
