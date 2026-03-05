import { env } from "../../config/env.js";
import type { FastifyBaseLogger } from "fastify";
import type { DataRetentionService } from "./service.js";

export class CleanupScheduler {
  private timer: NodeJS.Timeout | null = null;
  private inTick = false;

  constructor(
    private readonly cleanupService: DataRetentionService,
    private readonly logger: FastifyBaseLogger,
  ) {}

  start(): void {
    if (!env.cleanupEnabled) {
      this.logger.info("cleanup scheduler disabled by CLEANUP_ENABLED=false");
      return;
    }

    if (this.timer) {
      return;
    }

    const intervalMs = env.cleanupIntervalMinutes * 60 * 1000;
    this.timer = setInterval(() => {
      void this.tick();
    }, intervalMs);

    this.logger.info(
      {
        cleanupIntervalMinutes: env.cleanupIntervalMinutes,
      },
      "cleanup scheduler started",
    );
  }

  stop(): void {
    if (!this.timer) {
      return;
    }
    clearInterval(this.timer);
    this.timer = null;
  }

  private async tick(): Promise<void> {
    if (this.inTick) {
      this.logger.warn("cleanup scheduler tick skipped because previous tick is still running");
      return;
    }

    this.inTick = true;
    try {
      await this.cleanupService.runCleanupOnce({
        trigger: "scheduled",
      });
    } catch (error) {
      this.logger.error(
        {
          err: String((error as Error)?.message || error),
        },
        "cleanup scheduler tick failed",
      );
    } finally {
      this.inTick = false;
    }
  }
}
