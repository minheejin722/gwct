import type { Dirent } from "node:fs";
import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyBaseLogger } from "fastify";
import { env } from "../../config/env.js";
import type {
  Repository,
  SnapshotHistoryTrimResult,
  TransientRetentionCleanupResult,
} from "../../db/repository.js";

export type CleanupTrigger = "scheduled" | "manual" | "startup";

export interface CleanupRunOptions {
  trigger: CleanupTrigger;
  now?: Date;
  manualFullVacuum?: boolean;
  force?: boolean;
}

export interface FilesystemCleanupResult {
  filesDeleted: number;
  directoriesDeleted: number;
  bytesDeleted: number;
}

export interface CleanupCompactionResult {
  requestedFullVacuum: boolean;
  strategy: "off" | "incremental" | "manual_full" | "skipped";
  performed: boolean;
}

export interface CleanupRunResult {
  trigger: CleanupTrigger;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  cutoffIso: string;
  skipped: boolean;
  transient: TransientRetentionCleanupResult;
  snapshots: SnapshotHistoryTrimResult;
  filesystem: FilesystemCleanupResult;
  compaction: CleanupCompactionResult;
  dbSizeBeforeBytes: number;
  dbSizeAfterBytes: number;
  dbBytesReclaimed: number;
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(currentDir, "../../../data");
const prismaDir = path.resolve(currentDir, "../../../prisma");

const transientDataSubdirs = [
  "tmp",
  "temp",
  "debug",
  "diagnostics",
  "captures",
  "capture",
  "trace",
  "traces",
  "parser-debug",
  "parser-capture",
  "raw",
] as const;

const emptyTransientResult: TransientRetentionCleanupResult = {
  rawSnapshots: 0,
  parseErrors: 0,
  notificationLogs: 0,
  scrapeRuns: 0,
  detachedRawSnapshotRunRefs: 0,
  detachedParseErrorRunRefs: 0,
};

const emptySnapshotTrimResult: SnapshotHistoryTrimResult = {
  vesselScheduleItems: 0,
  craneStatuses: 0,
  equipmentLoginStatuses: 0,
  ytCountSnapshots: 0,
  weatherNoticeSnapshots: 0,
};

const emptyFilesystemResult: FilesystemCleanupResult = {
  filesDeleted: 0,
  directoriesDeleted: 0,
  bytesDeleted: 0,
};

function isPathNotFound(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

function resolveSqliteDatabasePath(databaseUrl: string): string | null {
  if (!databaseUrl.startsWith("file:")) {
    return null;
  }

  const raw = decodeURIComponent(databaseUrl.slice("file:".length));
  if (!raw || raw === ":memory:") {
    return null;
  }

  if (/^[A-Za-z]:[\\/]/.test(raw) || raw.startsWith("/")) {
    return raw;
  }

  return path.resolve(prismaDir, raw);
}

export class DataRetentionService {
  private inFlight: Promise<CleanupRunResult> | null = null;

  constructor(
    private readonly repo: Repository,
    private readonly logger: FastifyBaseLogger,
  ) {}

  async runCleanupOnce(options: CleanupRunOptions): Promise<CleanupRunResult> {
    if (this.inFlight) {
      this.logger.warn({ trigger: options.trigger }, "cleanup run skipped because previous run is still active");
      return this.inFlight;
    }

    const runPromise = this.executeCleanup(options);
    this.inFlight = runPromise;

    try {
      return await runPromise;
    } finally {
      this.inFlight = null;
    }
  }

  private async executeCleanup(options: CleanupRunOptions): Promise<CleanupRunResult> {
    const startedAt = new Date();

    if (!env.cleanupEnabled && !options.force) {
      return {
        trigger: options.trigger,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: 0,
        cutoffIso: startedAt.toISOString(),
        skipped: true,
        transient: { ...emptyTransientResult },
        snapshots: { ...emptySnapshotTrimResult },
        filesystem: { ...emptyFilesystemResult },
        compaction: {
          requestedFullVacuum: options.manualFullVacuum === true,
          strategy: "skipped",
          performed: false,
        },
        dbSizeBeforeBytes: await this.getDatabaseFileSizeBytes(),
        dbSizeAfterBytes: await this.getDatabaseFileSizeBytes(),
        dbBytesReclaimed: 0,
      };
    }

    const now = options.now || new Date();
    const cutoff = new Date(now.getTime() - env.transientRetentionMinutes * 60 * 1000);
    const dbSizeBeforeBytes = await this.getDatabaseFileSizeBytes();

    const transient = await this.repo.cleanupTransientData(cutoff);
    const snapshots = await this.repo.trimSnapshotHistory(2);
    const filesystem = await this.cleanupTransientArtifacts(cutoff);
    const compaction = await this.applyCompaction(options.manualFullVacuum === true);

    const dbSizeAfterBytes = await this.getDatabaseFileSizeBytes();
    const durationMs = Date.now() - startedAt.getTime();

    const result: CleanupRunResult = {
      trigger: options.trigger,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs,
      cutoffIso: cutoff.toISOString(),
      skipped: false,
      transient,
      snapshots,
      filesystem,
      compaction,
      dbSizeBeforeBytes,
      dbSizeAfterBytes,
      dbBytesReclaimed: Math.max(0, dbSizeBeforeBytes - dbSizeAfterBytes),
    };

    this.logger.info(
      {
        cleanup: {
          trigger: result.trigger,
          durationMs: result.durationMs,
          cutoffIso: result.cutoffIso,
          transient: result.transient,
          snapshots: result.snapshots,
          filesystem: result.filesystem,
          compaction: result.compaction,
          dbSizeBeforeBytes: result.dbSizeBeforeBytes,
          dbSizeAfterBytes: result.dbSizeAfterBytes,
          dbBytesReclaimed: result.dbBytesReclaimed,
        },
      },
      "data retention cleanup completed",
    );

    return result;
  }

  private async applyCompaction(requestedFullVacuum: boolean): Promise<CleanupCompactionResult> {
    if (env.dbCompactionMode === "off") {
      return {
        requestedFullVacuum,
        strategy: "off",
        performed: false,
      };
    }

    if (requestedFullVacuum) {
      await this.repo.runFullVacuum();
      return {
        requestedFullVacuum,
        strategy: "manual_full",
        performed: true,
      };
    }

    if (env.dbCompactionMode === "incremental") {
      await this.repo.runIncrementalVacuum(env.dbIncrementalVacuumPages);
      return {
        requestedFullVacuum,
        strategy: "incremental",
        performed: true,
      };
    }

    return {
      requestedFullVacuum,
      strategy: "skipped",
      performed: false,
    };
  }

  private async cleanupTransientArtifacts(cutoff: Date): Promise<FilesystemCleanupResult> {
    const result: FilesystemCleanupResult = {
      filesDeleted: 0,
      directoriesDeleted: 0,
      bytesDeleted: 0,
    };

    for (const dirName of transientDataSubdirs) {
      const target = path.join(dataDir, dirName);
      await this.pruneTransientPath(target, cutoff, result);
    }

    return result;
  }

  private async pruneTransientPath(targetPath: string, cutoff: Date, result: FilesystemCleanupResult): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await readdir(targetPath, { withFileTypes: true, encoding: "utf8" });
    } catch (error) {
      if (isPathNotFound(error)) {
        return;
      }
      throw error;
    }

    for (const entry of entries) {
      const fullPath = path.join(targetPath, entry.name);
      if (entry.isDirectory()) {
        await this.pruneTransientPath(fullPath, cutoff, result);
        const remaining = await readdir(fullPath, { encoding: "utf8" }).catch((error) =>
          isPathNotFound(error) ? [] : Promise.reject(error),
        );
        if (remaining.length === 0) {
          await rm(fullPath, { recursive: true, force: true });
          result.directoriesDeleted += 1;
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const fileStat = await stat(fullPath);
      if (fileStat.mtime >= cutoff) {
        continue;
      }

      await rm(fullPath, { force: true });
      result.filesDeleted += 1;
      result.bytesDeleted += fileStat.size;
    }
  }

  private async getDatabaseFileSizeBytes(): Promise<number> {
    const dbPath = resolveSqliteDatabasePath(env.DATABASE_URL);
    if (!dbPath) {
      return 0;
    }

    try {
      const info = await stat(dbPath);
      return info.size;
    } catch (error) {
      if (isPathNotFound(error)) {
        return 0;
      }
      throw error;
    }
  }
}


