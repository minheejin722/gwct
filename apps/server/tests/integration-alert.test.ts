import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EVENT_TO_DEEPLINK } from "@gwct/shared";
import { detectGcRemainingLowEvents, diffWeather } from "../src/engine/diff.js";
import { parseGwctGcRemaining } from "../src/parsers/gwct.js";
import { parseYsForecast } from "../src/parsers/ys.js";
import type { GcRemainingMonitorRule } from "../src/services/monitorConfig/store.js";

const forecastFixture = (setName: string) =>
  readFileSync(path.resolve(process.cwd(), "fixtures", setName, "ys_forecast.html"), "utf8");

const gcFixture = (setName: string) =>
  readFileSync(path.resolve(process.cwd(), "fixtures", setName, "gwct_gc_remaining.html"), "utf8");

describe("integration: parse -> diff -> notification payload", () => {
  it("creates ALL_SUSPENDED event and weather deep-link", () => {
    const first = parseYsForecast(forecastFixture("step1"), "2026-03-01T10:00:00.000Z", "ys_forecast").weather;
    const second = parseYsForecast(forecastFixture("step2"), "2026-03-01T10:01:00.000Z", "ys_forecast").weather;

    const events = diffWeather(first, second, "ys_forecast", "2026-03-01T10:01:00.000Z");
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("ALL_SUSPENDED");
    expect(EVENT_TO_DEEPLINK[events[0]!.type]).toBe("weather");
  });

  it("creates gc_remaining_low event and crane deep-link", () => {
    const before = parseGwctGcRemaining(gcFixture("step1"), "2026-03-01T10:00:00.000Z", "gwct_gc_remaining");
    const after = parseGwctGcRemaining(gcFixture("step2"), "2026-03-01T10:01:00.000Z", "gwct_gc_remaining");

    const monitorRules: Record<string, GcRemainingMonitorRule> = {
      "188": {
        enabled: true,
        threshold: 10,
      },
    };

    const events = detectGcRemainingLowEvents(
      before.cranes,
      after.cranes,
      monitorRules,
      "gwct_gc_remaining",
      "2026-03-01T10:01:00.000Z",
      {
        sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=F&s=A",
      },
    );

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("gc_remaining_low");
    expect(EVENT_TO_DEEPLINK[events[0]!.type]).toBe("cranes");
  });
});
