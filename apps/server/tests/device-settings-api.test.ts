import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";

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
});

describe("device settings api", () => {
  it("returns persisted alert, banner, and theme settings from device registration", async () => {
    const app = Fastify();
    createdApps.push(app);

    const { registerRoutes } = await import("../src/routes/api.js");
    await registerRoutes(app, {
      repo: {
        async registerDevice(input: Record<string, unknown>) {
          return {
            id: "dev_1",
            deviceId: input.deviceId,
            platform: input.platform,
            alertsEnabled: false,
            bannerEnabled: false,
            themeMode: "dark",
          };
        },
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
      method: "POST",
      url: "/api/devices/register",
      payload: {
        deviceId: "iphone-1",
        platform: "ios",
        expoPushToken: "ExponentPushToken[test]",
        timezone: "Asia/Seoul",
        appVersion: null,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      deviceId: "iphone-1",
      platform: "ios",
      alertsEnabled: false,
      bannerEnabled: false,
      themeMode: "dark",
    });
  });

  it("patches alert, banner, and theme settings together", async () => {
    const app = Fastify();
    createdApps.push(app);
    const capturedUpdates: Array<Record<string, unknown>> = [];

    const { registerRoutes } = await import("../src/routes/api.js");
    await registerRoutes(app, {
      repo: {
        async updateDeviceSettings(deviceId: string, settings: Record<string, unknown>) {
          capturedUpdates.push({ deviceId, ...settings });
          return {
            id: "dev_2",
            deviceId,
            alertsEnabled: settings.alertsEnabled,
            bannerEnabled: settings.bannerEnabled,
            themeMode: settings.themeMode,
            updatedAt: new Date("2026-03-06T12:00:00.000Z"),
          };
        },
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
      method: "PATCH",
      url: "/api/settings/device/iphone-2",
      payload: {
        alertsEnabled: true,
        bannerEnabled: false,
        themeMode: "system",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(capturedUpdates).toEqual([
      {
        deviceId: "iphone-2",
        alertsEnabled: true,
        bannerEnabled: false,
        themeMode: "system",
        quietHoursFrom: undefined,
        quietHoursTo: undefined,
        categoryPrefs: undefined,
      },
    ]);
    expect(response.json()).toMatchObject({
      deviceId: "iphone-2",
      alertsEnabled: true,
      bannerEnabled: false,
      themeMode: "system",
    });
  });
});
