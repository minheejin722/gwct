import { access, mkdir, rm, stat, utimes, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type {
  SnapshotHistoryTrimResult,
  TransientRetentionCleanupResult,
} from "../src/db/repository.js";

interface CleanupRepoStub {
  cleanupTransientData(cutoff: Date): Promise<TransientRetentionCleanupResult>;
  trimSnapshotHistory(keepSeenAtGroupsPerSource: number): Promise<SnapshotHistoryTrimResult>;
  runIncrementalVacuum(pageCount: number): Promise<void>;
  runFullVacuum(): Promise<void>;
}

class FakeCleanupRepository implements CleanupRepoStub {
  cleanupCalls = 0;
  trimCalls = 0;
  incrementalCalls = 0;
  fullVacuumCalls = 0;
  lastCutoff: Date | null = null;
  lastTrimKeepCount: number | null = null;

  async cleanupTransientData(cutoff: Date): Promise<TransientRetentionCleanupResult> {
    this.cleanupCalls += 1;
    this.lastCutoff = cutoff;
    return {
      rawSnapshots: 5,
      parseErrors: 3,
      notificationLogs: 4,
      scrapeRuns: 2,
      detachedRawSnapshotRunRefs: 1,
      detachedParseErrorRunRefs: 1,
    };
  }

  async trimSnapshotHistory(keepSeenAtGroupsPerSource: number): Promise<SnapshotHistoryTrimResult> {
    this.trimCalls += 1;
    this.lastTrimKeepCount = keepSeenAtGroupsPerSource;
    return {
      vesselScheduleItems: 10,
      craneStatuses: 8,
      equipmentLoginStatuses: 12,
      ytCountSnapshots: 1,
      weatherNoticeSnapshots: 1,
    };
  }

  async runIncrementalVacuum(): Promise<void> {
    this.incrementalCalls += 1;
  }

  async runFullVacuum(): Promise<void> {
    this.fullVacuumCalls += 1;
  }
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

const dataDir = path.resolve(process.cwd(), "data");
const fixturesDir = path.resolve(process.cwd(), "fixtures");

const testTmpDir = path.join(dataDir, "tmp", "cleanup-service-test");
const testDebugDir = path.join(dataDir, "debug", "cleanup-service-test");
const testLatestFile = path.join(dataDir, "latest", "cleanup-service-keep.json");
const testConfigFile = path.join(dataDir, "config", "cleanup-service-config-keep.json");
const testFixtureFile = path.join(fixturesDir, "cleanup-service-fixture-keep.html");

async function exists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function loadCleanupModules() {
  if (process.env.MODE !== "live" && process.env.MODE !== "fixture") {
    process.env.MODE = "fixture";
  }

  const [{ env }, { DataRetentionService }] = await Promise.all([
    import("../src/config/env.js"),
    import("../src/services/cleanup/service.js"),
  ]);

  return {
    env: env as unknown as {
      cleanupEnabled: boolean;
      transientRetentionMinutes: number;
      dbCompactionMode: "off" | "incremental" | "manual";
      dbIncrementalVacuumPages: number;
    },
    DataRetentionService,
  };
}

afterEach(async () => {
  await rm(path.join(dataDir, "tmp", "cleanup-service-test"), { recursive: true, force: true });
  await rm(path.join(dataDir, "debug", "cleanup-service-test"), { recursive: true, force: true });
  await rm(testLatestFile, { force: true });
  await rm(testConfigFile, { force: true });
  await rm(testFixtureFile, { force: true });

  const { env } = await loadCleanupModules();
  env.cleanupEnabled = true;
  env.transientRetentionMinutes = 15;
  env.dbCompactionMode = "incremental";
  env.dbIncrementalVacuumPages = 256;
});

describe("data retention cleanup service", () => {
  it("deletes only stale transient files and preserves latest/config/fixtures", async () => {
    const { env, DataRetentionService } = await loadCleanupModules();
    const original = {
      cleanupEnabled: env.cleanupEnabled,
      transientRetentionMinutes: env.transientRetentionMinutes,
      dbCompactionMode: env.dbCompactionMode,
      dbIncrementalVacuumPages: env.dbIncrementalVacuumPages,
    };

    env.cleanupEnabled = true;
    env.transientRetentionMinutes = 15;
    env.dbCompactionMode = "off";
    env.dbIncrementalVacuumPages = 256;

    await mkdir(testTmpDir, { recursive: true });
    await mkdir(testDebugDir, { recursive: true });
    await mkdir(path.dirname(testLatestFile), { recursive: true });
    await mkdir(path.dirname(testConfigFile), { recursive: true });
    await mkdir(path.dirname(testFixtureFile), { recursive: true });

    const repo = new FakeCleanupRepository();
    const service = new DataRetentionService(repo as any, loggerStub);

    const now = new Date("2026-03-05T00:30:00.000Z");
    const oldTime = new Date("2026-03-05T00:00:00.000Z");
    const freshTime = new Date("2026-03-05T00:25:00.000Z");

    const oldTmpFile = path.join(testTmpDir, "old.log");
    const freshTmpFile = path.join(testTmpDir, "fresh.log");
    const oldDebugFile = path.join(testDebugDir, "old-debug.txt");

    await writeFile(oldTmpFile, "old", "utf8");
    await writeFile(freshTmpFile, "fresh", "utf8");
    await writeFile(oldDebugFile, "old-debug", "utf8");
    await writeFile(testLatestFile, "{\"keep\":true}", "utf8");
    await writeFile(testConfigFile, "{\"state\":\"keep\"}", "utf8");
    await writeFile(testFixtureFile, "<html>fixture</html>", "utf8");

    await utimes(oldTmpFile, oldTime, oldTime);
    await utimes(oldDebugFile, oldTime, oldTime);
    await utimes(freshTmpFile, freshTime, freshTime);
    await utimes(testLatestFile, oldTime, oldTime);
    await utimes(testConfigFile, oldTime, oldTime);
    await utimes(testFixtureFile, oldTime, oldTime);

    const latestBefore = await stat(testLatestFile);
    const configBefore = await stat(testConfigFile);

    const result = await service.runCleanupOnce({
      trigger: "manual",
      force: true,
      now,
    });

    expect(result.skipped).toBe(false);
    expect(repo.cleanupCalls).toBe(1);
    expect(repo.trimCalls).toBe(1);
    expect(repo.lastTrimKeepCount).toBe(2);
    expect(result.filesystem.filesDeleted).toBeGreaterThanOrEqual(2);

    expect(await exists(oldTmpFile)).toBe(false);
    expect(await exists(oldDebugFile)).toBe(false);
    expect(await exists(freshTmpFile)).toBe(true);
    expect(await exists(testLatestFile)).toBe(true);
    expect(await exists(testConfigFile)).toBe(true);
    expect(await exists(testFixtureFile)).toBe(true);

    const latestAfter = await stat(testLatestFile);
    const configAfter = await stat(testConfigFile);
    expect(latestAfter.mtimeMs).toBe(latestBefore.mtimeMs);
    expect(configAfter.mtimeMs).toBe(configBefore.mtimeMs);

    env.cleanupEnabled = original.cleanupEnabled;
    env.transientRetentionMinutes = original.transientRetentionMinutes;
    env.dbCompactionMode = original.dbCompactionMode;
    env.dbIncrementalVacuumPages = original.dbIncrementalVacuumPages;
  });

  it("does not run cleanup when disabled unless force=true", async () => {
    const { env, DataRetentionService } = await loadCleanupModules();
    const original = {
      cleanupEnabled: env.cleanupEnabled,
      dbCompactionMode: env.dbCompactionMode,
    };

    env.cleanupEnabled = false;
    env.dbCompactionMode = "off";

    const repo = new FakeCleanupRepository();
    const service = new DataRetentionService(repo as any, loggerStub);

    const skipped = await service.runCleanupOnce({
      trigger: "scheduled",
      now: new Date("2026-03-05T01:00:00.000Z"),
    });

    expect(skipped.skipped).toBe(true);
    expect(repo.cleanupCalls).toBe(0);
    expect(repo.trimCalls).toBe(0);

    const forced = await service.runCleanupOnce({
      trigger: "manual",
      force: true,
      now: new Date("2026-03-05T01:00:00.000Z"),
    });

    expect(forced.skipped).toBe(false);
    expect(repo.cleanupCalls).toBe(1);
    expect(repo.trimCalls).toBe(1);

    env.cleanupEnabled = original.cleanupEnabled;
    env.dbCompactionMode = original.dbCompactionMode;
  });

  it("uses incremental compaction for regular runs and full vacuum only when explicitly requested", async () => {
    const { env, DataRetentionService } = await loadCleanupModules();
    const original = {
      cleanupEnabled: env.cleanupEnabled,
      dbCompactionMode: env.dbCompactionMode,
      dbIncrementalVacuumPages: env.dbIncrementalVacuumPages,
    };

    env.cleanupEnabled = true;
    env.dbCompactionMode = "incremental";
    env.dbIncrementalVacuumPages = 64;

    const repo = new FakeCleanupRepository();
    const service = new DataRetentionService(repo as any, loggerStub);

    const regular = await service.runCleanupOnce({
      trigger: "scheduled",
      force: true,
      now: new Date("2026-03-05T02:00:00.000Z"),
    });

    expect(regular.compaction.strategy).toBe("incremental");
    expect(repo.incrementalCalls).toBe(1);
    expect(repo.fullVacuumCalls).toBe(0);

    const manualFull = await service.runCleanupOnce({
      trigger: "manual",
      force: true,
      manualFullVacuum: true,
      now: new Date("2026-03-05T02:01:00.000Z"),
    });

    expect(manualFull.compaction.strategy).toBe("manual_full");
    expect(repo.fullVacuumCalls).toBe(1);

    env.cleanupEnabled = original.cleanupEnabled;
    env.dbCompactionMode = original.dbCompactionMode;
    env.dbIncrementalVacuumPages = original.dbIncrementalVacuumPages;
  });
});
