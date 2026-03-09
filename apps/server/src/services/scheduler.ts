import { env } from "../config/env.js";
import type { MonitorService } from "./monitorService.js";
import { SOURCE_DEFINITIONS } from "../scraper/sources.js";

export class Scheduler {
  private tasks = new Map<string, NodeJS.Timeout>();
  private running = false;

  constructor(private readonly monitorService: MonitorService) {}

  async start(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;

    for (const source of SOURCE_DEFINITIONS) {
      const run = async () => {
        if (!this.running) {
          return;
        }

        const startedAt = Date.now();
        await this.monitorService.runSourceOnce(source);

        const elapsedMs = Date.now() - startedAt;
        const nextDelayMs = Math.max(0, source.intervalMs - elapsedMs);
        const timer = setTimeout(run, nextDelayMs);
        this.tasks.set(source.source, timer);
      };

      const initialJitterMs = Math.floor(Math.random() * Math.min(env.JITTER_MS, source.intervalMs));
      const timer = setTimeout(run, 1000 + initialJitterMs);
      this.tasks.set(source.source, timer);
    }
  }

  stop(): void {
    this.running = false;
    for (const timer of this.tasks.values()) {
      clearTimeout(timer);
    }
    this.tasks.clear();
  }
}
