import { env } from "../config/env.js";
import { wait } from "../lib/async.js";
import type { MonitorService } from "./monitorService.js";
import { SOURCE_DEFINITIONS } from "../scraper/sources.js";

interface ScheduledTask {
  source: string;
  timer: NodeJS.Timeout;
}

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

        const jitter = Math.floor(Math.random() * env.JITTER_MS);
        await wait(jitter);
        await this.monitorService.runSourceOnce(source);

        const timer = setTimeout(run, source.intervalMs);
        this.tasks.set(source.source, timer);
      };

      const timer = setTimeout(run, 1000);
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
