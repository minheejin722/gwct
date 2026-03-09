import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function loadSchedulerModules() {
  if (process.env.MODE !== "live" && process.env.MODE !== "fixture") {
    process.env.MODE = "fixture";
  }

  const [{ env }, { Scheduler }] = await Promise.all([
    import("../src/config/env.js"),
    import("../src/services/scheduler.js"),
  ]);

  return {
    env: env as unknown as {
      GWCT_INTERVAL_MS: number;
      GWCT_GC_INTERVAL_MS: number;
      YS_INTERVAL_MS: number;
      JITTER_MS: number;
    },
    Scheduler,
  };
}

describe("scheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-10T00:00:00.000Z"));
  });

  afterEach(async () => {
    vi.useRealTimers();
    const { env } = await loadSchedulerModules();
    env.GWCT_INTERVAL_MS = 2000;
    env.GWCT_GC_INTERVAL_MS = 2000;
    env.YS_INTERVAL_MS = 10000;
    env.JITTER_MS = 250;
  });

  it("keeps the next run aligned to the configured start cadence instead of waiting the full interval after completion", async () => {
    const { env, Scheduler } = await loadSchedulerModules();
    env.GWCT_INTERVAL_MS = 2000;
    env.GWCT_GC_INTERVAL_MS = 20000;
    env.YS_INTERVAL_MS = 20000;
    env.JITTER_MS = 0;

    const starts: string[] = [];
    const monitorService = {
      async runSourceOnce(source: { source: string }) {
        if (source.source !== "gwct_schedule_list") {
          return;
        }
        starts.push(new Date(Date.now()).toISOString());
        await new Promise((resolve) => setTimeout(resolve, 1500));
      },
    };

    const scheduler = new Scheduler(monitorService as any);
    await scheduler.start();

    await vi.advanceTimersByTimeAsync(6100);

    expect(starts).toEqual([
      "2026-03-10T00:00:01.000Z",
      "2026-03-10T00:00:03.000Z",
      "2026-03-10T00:00:05.000Z",
    ]);

    scheduler.stop();
  });
});
