import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./config/env.js";
import { baseLoggerConfig } from "./lib/logger.js";
import { SseHub } from "./lib/sse.js";
import { Repository } from "./db/repository.js";
import { BrowserPool } from "./scraper/browser.js";
import { HtmlFetcher } from "./scraper/fetcher.js";
import { NotificationService } from "./notifications/service.js";
import { NoopNotificationProvider } from "./notifications/noopProvider.js";
import { ExpoPushProvider } from "./notifications/expoProvider.js";
import { MonitorService } from "./services/monitorService.js";
import { Scheduler } from "./services/scheduler.js";
import { DataRetentionService } from "./services/cleanup/service.js";
import { CleanupScheduler } from "./services/cleanup/scheduler.js";
import { registerRoutes } from "./routes/api.js";

export async function createRuntime() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      ...baseLoggerConfig,
    },
  });

  await app.register(cors, {
    origin: true,
  });

  const repo = new Repository();
  const sseHub = new SseHub();
  const browserPool = new BrowserPool();
  const fetcher = new HtmlFetcher(browserPool);
  const provider = env.expoPushEnabled ? new ExpoPushProvider() : new NoopNotificationProvider();
  const notificationService = new NotificationService(repo, provider, sseHub);
  const monitorService = new MonitorService(repo, fetcher, notificationService, sseHub, app.log);
  const scheduler = new Scheduler(monitorService);
  const cleanupService = new DataRetentionService(repo, app.log);
  const cleanupScheduler = new CleanupScheduler(cleanupService, app.log);

  await registerRoutes(app, {
    repo,
    monitorService,
    sseHub,
    cleanupService,
  });

  return {
    app,
    repo,
    monitorService,
    scheduler,
    cleanupService,
    cleanupScheduler,
    browserPool,
  };
}
