import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

const createdApps: Array<Awaited<ReturnType<typeof Fastify>>> = [];

async function loadRouteModules() {
  if (process.env.MODE !== "live" && process.env.MODE !== "fixture") {
    process.env.MODE = "fixture";
  }

  const [{ env }, { registerRoutes }] = await Promise.all([
    import("../src/config/env.js"),
    import("../src/routes/api.js"),
  ]);

  return {
    env,
    registerRoutes,
  };
}

afterEach(async () => {
  while (createdApps.length) {
    const app = createdApps.pop();
    if (app) {
      await app.close();
    }
  }
});

describe("cleanup admin endpoint", () => {
  it("requires debug token and triggers manual cleanup idempotently", async () => {
    const { env, registerRoutes } = await loadRouteModules();

    const runCleanupOnce = vi.fn(async () => ({
      trigger: "manual",
      skipped: false,
    }));

    const app = Fastify();
    createdApps.push(app);

    await registerRoutes(app, {
      repo: {
        getRecentAlerts: async () => [],
      } as any,
      monitorService: {} as any,
      sseHub: {
        broadcast() {
          // no-op
        },
      } as any,
      cleanupService: {
        runCleanupOnce,
      } as any,
    });

    const unauthorized = await app.inject({
      method: "POST",
      url: "/api/admin/cleanup/run",
    });
    expect(unauthorized.statusCode).toBe(401);

    const first = await app.inject({
      method: "POST",
      url: "/api/admin/cleanup/run",
      headers: {
        "x-debug-token": env.DEBUG_TOKEN,
      },
      payload: {
        fullVacuum: false,
      },
    });

    expect(first.statusCode).toBe(200);
    expect(runCleanupOnce).toHaveBeenCalledTimes(1);
    expect(runCleanupOnce).toHaveBeenLastCalledWith({
      trigger: "manual",
      force: true,
      manualFullVacuum: false,
    });

    const second = await app.inject({
      method: "POST",
      url: "/api/admin/cleanup/run",
      headers: {
        "x-debug-token": env.DEBUG_TOKEN,
      },
      payload: {
        fullVacuum: true,
      },
    });

    expect(second.statusCode).toBe(200);
    expect(runCleanupOnce).toHaveBeenCalledTimes(2);
    expect(runCleanupOnce).toHaveBeenLastCalledWith({
      trigger: "manual",
      force: true,
      manualFullVacuum: true,
    });
  });
});
