import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.string().default("info"),
  DATABASE_URL: z.string().default("file:./data/dev.db"),
  TIMEZONE: z.string().default("Asia/Seoul"),
  MODE: z.enum(["live", "fixture"]).default("live"),
  DEBUG_TOKEN: z.string().default("changeme"),
  GWCT_INTERVAL_MS: z.coerce.number().default(30000),
  GWCT_GC_INTERVAL_MS: z.coerce.number().default(25000),
  YS_INTERVAL_MS: z.coerce.number().default(60000),
  MAX_RETRIES: z.coerce.number().default(2),
  BACKOFF_BASE_MS: z.coerce.number().default(1000),
  JITTER_MS: z.coerce.number().default(3000),
  REQUEST_TIMEOUT_MS: z.coerce.number().default(30000),
  PLAYWRIGHT_HEADLESS: z.string().default("true"),
  COOLDOWN_MINUTES: z.coerce.number().default(5),
  SCHEDULE_ALERT_ON_WINDOW_ENTER: z.string().default("false"),
  EXPO_PUSH_ENABLED: z.string().default("false"),
  EXPO_ACCESS_TOKEN: z.string().optional(),
  IOS_CUSTOM_ALERT_SOUND: z.string().default("false"),
  CLEANUP_ENABLED: z.string().default("true"),
  CLEANUP_INTERVAL_MINUTES: z.coerce.number().default(15),
  TRANSIENT_RETENTION_MINUTES: z.coerce.number().default(15),
  RAW_SNAPSHOT_PERSIST: z.enum(["off", "errors_only", "all"]).default("errors_only"),
  DB_COMPACTION_MODE: z.enum(["incremental", "manual", "off"]).default("incremental"),
  DB_INCREMENTAL_VACUUM_PAGES: z.coerce.number().default(256),
});

const parsed = EnvSchema.parse(process.env);

export const env = {
  ...parsed,
  playwrightHeadless: parsed.PLAYWRIGHT_HEADLESS !== "false",
  expoPushEnabled: parsed.EXPO_PUSH_ENABLED === "true",
  scheduleAlertOnWindowEnter: parsed.SCHEDULE_ALERT_ON_WINDOW_ENTER === "true",
  iosCustomAlertSound: parsed.IOS_CUSTOM_ALERT_SOUND === "true",
  cleanupEnabled: parsed.CLEANUP_ENABLED !== "false",
  cleanupIntervalMinutes: Math.max(1, Math.trunc(parsed.CLEANUP_INTERVAL_MINUTES)),
  transientRetentionMinutes: Math.max(1, Math.trunc(parsed.TRANSIENT_RETENTION_MINUTES)),
  rawSnapshotPersist: parsed.RAW_SNAPSHOT_PERSIST,
  dbCompactionMode: parsed.DB_COMPACTION_MODE,
  dbIncrementalVacuumPages: Math.max(1, Math.trunc(parsed.DB_INCREMENTAL_VACUUM_PAGES)),
  urls: {
    gwctH: "http://www.gwct.co.kr:8080/dashboard/?m=H&s=A",
    gwctI: "http://www.gwct.co.kr:8080/dashboard/?m=I&s=A",
    gwctF: "http://www.gwct.co.kr:8080/dashboard/?m=F&s=A",
    gwctD: "http://www.gwct.co.kr:8080/dashboard/?m=D&s=A",
    ysForecast: "http://www.yspilot.co.kr/forecast",
    ysForecastStatus: "http://www.yspilot.co.kr/forecast/status",
    ysNotice: "http://www.yspilot.co.kr/boards/lists/notice",
  },
} as const;

export type AppEnv = typeof env;
