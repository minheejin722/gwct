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
});

const parsed = EnvSchema.parse(process.env);

export const env = {
  ...parsed,
  playwrightHeadless: parsed.PLAYWRIGHT_HEADLESS !== "false",
  expoPushEnabled: parsed.EXPO_PUSH_ENABLED === "true",
  scheduleAlertOnWindowEnter: parsed.SCHEDULE_ALERT_ON_WINDOW_ENTER === "true",
  iosCustomAlertSound: parsed.IOS_CUSTOM_ALERT_SOUND === "true",
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
