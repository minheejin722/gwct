import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function loadSchedulerModules() {
  if (process.env.MODE !== "live" && process.env.MODE !== "fixture") {
    process.env.MODE = "fixture";
  }

  const [{ env }, { CleanupScheduler }] = await Promise.all([
    import("../src/config/env.js"),
    import("../src/services/cleanup/scheduler.js"),
  ]);

  return {
    env: env as unknown as {
      cleanupEnabled: boolean;
      cleanupIntervalMinutes: number;
    },
    CleanupScheduler,
  };
}

const loggerStub = {
  info() {
    // no-op
  },
  warn() {
    // no-op
  },
  error() {
    // no-op
  },
} as any;

describe("cleanup scheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.useRealTimers();
    const { env } = await loadSchedulerModules();
    env.cleanupEnabled = true;
    env.cleanupIntervalMinutes = 15;
  });

  it("runs periodic cleanup without requesting full vacuum", async () => {
    const { env, CleanupScheduler } = await loadSchedulerModules();
    env.cleanupEnabled = true;
    env.cleanupIntervalMinutes = 15;

    const calls: Array<{ trigger: string; manualFullVacuum?: boolean }> = [];
    const cleanupService = {
      async runCleanupOnce(input: { trigger: string; manualFullVacuum?: boolean }) {
        calls.push(input);
        return {};
      },
    };

    const scheduler = new CleanupScheduler(cleanupService as any, loggerStub);
    scheduler.start();

    await vi.advanceTimersByTimeAsync(15 * 60 * 1000 + 100);

    expect(calls.length).toBe(1);
    expect(calls[0]?.trigger).toBe("scheduled");
    expect(calls[0]?.manualFullVacuum).toBeUndefined();

    scheduler.stop();
  });

  it("does not start timer when cleanup is disabled", async () => {
    const { env, CleanupScheduler } = await loadSchedulerModules();
    env.cleanupEnabled = false;
    env.cleanupIntervalMinutes = 15;

    let callCount = 0;
    const cleanupService = {
      async runCleanupOnce() {
        callCount += 1;
        return {};
      },
    };

    const scheduler = new CleanupScheduler(cleanupService as any, loggerStub);
    scheduler.start();

    await vi.advanceTimersByTimeAsync(20 * 60 * 1000);
    expect(callCount).toBe(0);

    scheduler.stop();
  });
});
