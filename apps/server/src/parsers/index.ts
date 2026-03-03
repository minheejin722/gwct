import type { SourceId } from "@gwct/shared";
import {
  parseGwctEquipmentStatus,
  parseGwctGcRemaining,
  parseGwctScheduleChart,
  parseGwctScheduleList,
  parseGwctWorkStatus,
} from "./gwct.js";
import type { NormalizedSnapshotBundle } from "./types.js";
import { parseYsForecast, parseYsNotice } from "./ys.js";

export function parseBySource(source: SourceId, html: string, seenAt: string): NormalizedSnapshotBundle {
  switch (source) {
    case "gwct_schedule_list":
      return parseGwctScheduleList(html, seenAt, source);
    case "gwct_schedule_chart":
      return parseGwctScheduleChart(html, seenAt, source);
    case "gwct_work_status":
      return parseGwctWorkStatus(html, seenAt, source);
    case "gwct_gc_remaining":
      return parseGwctGcRemaining(html, seenAt, source);
    case "gwct_equipment_status":
      return parseGwctEquipmentStatus(html, seenAt, source);
    case "ys_forecast":
      return parseYsForecast(html, seenAt, source);
    case "ys_notice":
      return parseYsNotice(html, seenAt, source);
    default:
      return {
        vessels: [],
        cranes: [],
        equipment: [],
        yt: null,
        weather: null,
        diagnostics: [
          {
            parserName: "parseBySource",
            reason: "unsupported source",
            diagnostics: { source },
          },
        ],
      };
  }
}
