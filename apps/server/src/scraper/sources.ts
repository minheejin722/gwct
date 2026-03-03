import type { SourceId } from "@gwct/shared";
import { env } from "../config/env.js";

export interface SourceDefinition {
  source: SourceId;
  url: string;
  intervalMs: number;
}

export const SOURCE_DEFINITIONS: SourceDefinition[] = [
  {
    source: "gwct_schedule_list",
    url: env.urls.gwctH,
    intervalMs: env.GWCT_INTERVAL_MS,
  },
  {
    source: "gwct_work_status",
    url: env.urls.gwctF,
    intervalMs: env.GWCT_INTERVAL_MS,
  },
  {
    source: "gwct_gc_remaining",
    url: env.urls.gwctF,
    intervalMs: env.GWCT_GC_INTERVAL_MS,
  },
  {
    source: "gwct_equipment_status",
    url: env.urls.gwctD,
    intervalMs: env.GWCT_INTERVAL_MS,
  },
  {
    source: "ys_forecast",
    url: env.urls.ysForecast,
    intervalMs: env.YS_INTERVAL_MS,
  },
  {
    source: "ys_notice",
    url: env.urls.ysNotice,
    intervalMs: env.YS_INTERVAL_MS,
  },
];
