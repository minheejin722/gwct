import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

if (process.env.MODE !== "live" && process.env.MODE !== "fixture") {
  process.env.MODE = "fixture";
}

const loadMonitorSettingsMock = vi.fn();
const saveMonitorSettingsMock = vi.fn();
const loadScheduleFocusSnapshotMock = vi.fn();

vi.mock("../src/services/monitorConfig/store.js", () => ({
  loadMonitorSettings: loadMonitorSettingsMock,
  saveMonitorSettings: saveMonitorSettingsMock,
}));

vi.mock("../src/services/scheduleFocus/latestStore.js", () => ({
  loadScheduleFocusSnapshot: loadScheduleFocusSnapshotMock,
}));

const createdApps: Array<Awaited<ReturnType<typeof Fastify>>> = [];

describe("gwct eta api", () => {
  afterEach(async () => {
    while (createdApps.length) {
      const app = createdApps.pop();
      if (app) {
        await app.close();
      }
    }
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns lastChangedAt and slices preview by trackingCount without leaking internal signature", async () => {
    loadMonitorSettingsMock.mockResolvedValue({
      gwctEtaMonitor: {
        enabled: true,
        trackingCount: 2,
        lastTrackedSignature: "internal-signature",
        lastChangedAt: "2026-03-08T01:23:00.000Z",
      },
      gcRemainingMonitors: {},
      equipmentMonitor: {
        yt: {
          enabled: false,
          threshold: 25,
          stateInitialized: false,
          state: null,
        },
        gcStaff: {
          enabled: false,
        },
      },
      yeosuPilotageMonitor: {
        enabled: false,
        lastRawText: null,
        lastNormalizedState: null,
        lastChangedAt: null,
      },
    });

    loadScheduleFocusSnapshotMock.mockResolvedValue({
      source: "gwct_schedule_list",
      sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=H&s=A",
      capturedAt: "2026-03-08T01:30:00.000Z",
      startReason: "first_yellow",
      items: [
        {
          indexInWatchWindow: 1,
          voyage: "VOY1",
          vesselName: "VESSEL1",
          eta: "2026-03-08T10:00:00.000Z",
          etaNormalized: "2026-03-08T10:00",
          rowColor: "yellow",
          rowClass: "bg_on",
        },
        {
          indexInWatchWindow: 2,
          voyage: "VOY2",
          vesselName: "VESSEL2",
          eta: "2026-03-08T11:00:00.000Z",
          etaNormalized: "2026-03-08T11:00",
          rowColor: "cyan",
          rowClass: "bg_yet",
        },
        {
          indexInWatchWindow: 3,
          voyage: "VOY3",
          vesselName: "VESSEL3",
          eta: "2026-03-08T12:00:00.000Z",
          etaNormalized: "2026-03-08T12:00",
          rowColor: "cyan",
          rowClass: "bg_yet",
        },
      ],
    });

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
      url: "/api/monitors/gwct-eta",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      enabled: true,
      trackingCount: 2,
      lastChangedAt: "2026-03-08T01:23:00.000Z",
      preview: [
        {
          indexInWatchWindow: 1,
          voyage: "VOY1",
          vesselName: "VESSEL1",
          eta: "2026-03-08T10:00:00.000Z",
          etaNormalized: "2026-03-08T10:00",
          rowColor: "yellow",
          rowClass: "bg_on",
        },
        {
          indexInWatchWindow: 2,
          voyage: "VOY2",
          vesselName: "VESSEL2",
          eta: "2026-03-08T11:00:00.000Z",
          etaNormalized: "2026-03-08T11:00",
          rowColor: "cyan",
          rowClass: "bg_yet",
        },
      ],
    });
  });
});
