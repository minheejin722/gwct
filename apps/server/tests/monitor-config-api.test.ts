import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

if (process.env.MODE !== "live" && process.env.MODE !== "fixture") {
  process.env.MODE = "fixture";
}

const loadMonitorSettingsMock = vi.fn();
const saveMonitorSettingsMock = vi.fn();

vi.mock("../src/services/monitorConfig/store.js", () => ({
  loadMonitorSettings: loadMonitorSettingsMock,
  saveMonitorSettings: saveMonitorSettingsMock,
}));

const createdApps: Array<Awaited<ReturnType<typeof Fastify>>> = [];

const configPayload = {
  gwctEtaMonitor: {
    enabled: false,
    trackingCount: 11,
    lastTrackedSignature: null,
    lastChangedAt: null,
  },
  gcRemainingMonitors: {},
  gcProgressMonitors: {
    "185": {
      enabled: true,
      thresholdPercent: 99.5,
    },
  },
  gcTotalProgressMonitor: {
    enabled: true,
    thresholdPercent: 99.7,
  },
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
};

describe("monitor config api", () => {
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

  it("returns and saves GC progress monitor fields through the shared monitor config route", async () => {
    loadMonitorSettingsMock.mockResolvedValue(configPayload);
    saveMonitorSettingsMock.mockResolvedValue({
      ...configPayload,
      gcProgressMonitors: {
        "185": {
          enabled: true,
          thresholdPercent: 99.8,
        },
      },
      gcTotalProgressMonitor: {
        enabled: true,
        thresholdPercent: 99.9,
      },
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

    const getResponse = await app.inject({
      method: "GET",
      url: "/api/monitors/config",
    });

    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json()).toMatchObject({
      gcProgressMonitors: {
        "185": {
          enabled: true,
          thresholdPercent: 99.5,
        },
      },
      gcTotalProgressMonitor: {
        enabled: true,
        thresholdPercent: 99.7,
      },
    });

    const postResponse = await app.inject({
      method: "POST",
      url: "/api/monitors/config",
      payload: {
        gcProgressMonitors: {
          "185": {
            enabled: true,
            thresholdPercent: 99.8,
          },
        },
        gcTotalProgressMonitor: {
          enabled: true,
          thresholdPercent: 99.9,
        },
      },
    });

    expect(postResponse.statusCode).toBe(200);
    expect(saveMonitorSettingsMock).toHaveBeenCalledWith({
      gcProgressMonitors: {
        "185": {
          enabled: true,
          thresholdPercent: 99.8,
        },
      },
      gcTotalProgressMonitor: {
        enabled: true,
        thresholdPercent: 99.9,
      },
    });
    expect(postResponse.json()).toMatchObject({
      gcProgressMonitors: {
        "185": {
          enabled: true,
          thresholdPercent: 99.8,
        },
      },
      gcTotalProgressMonitor: {
        enabled: true,
        thresholdPercent: 99.9,
      },
    });
  });
});
