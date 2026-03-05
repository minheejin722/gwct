import { describe, expect, it } from "vitest";
import { diffWeather } from "../src/engine/diff.js";
import { parseYsForecast } from "../src/parsers/ys.js";

const DISPATCH_HEADER = "\uBC30\uC120\uD300\uADFC\uBB34";
const STANDBY_HEADER = "\uB300\uAE30\uD638\uCD9C\uC790";

const SUSPEND_TEXT = "13\uC2DC30\uBD84\uBD80\uB85C \uAE30\uC0C1 \uC545\uD654\uB85C \uC778\uD558\uC5EC \uC804\uCCB4 \uB3C4\uC120 \uC911\uB2E8.";
const NORMAL_TEXT = "\uD3C9\uC2DC \uBC30\uC120";
const STANDBY_NORMAL_TEXT = "1\uB300\uAE30:O.K 2\uB300\uAE30:GD.KM \uD734\uAC00:DJ";
const SUSPEND_SHORT_TEXT = "\uAE30\uC0C1 \uC545\uD654\uB85C \uB3C4\uC120 \uC911\uB2E8";
const AMBIGUOUS_DISPATCH_TEXT = "\uD604\uC7A5 \uC810\uAC80\uC911";
const AMBIGUOUS_STANDBY_TEXT = "\uC0C1\uD669 \uD655\uC778\uC911";

function forecastHtml(dispatchTeamText: string, standbyCallText: string): string {
  return `<table><tr><td class="bg">${DISPATCH_HEADER}</td><td class="datatype1">${dispatchTeamText}</td><td class="bg">${STANDBY_HEADER}</td><td class="datatype1">${standbyCallText}</td></tr></table>`;
}

describe("weather diff semantic transitions", () => {
  it("emits ALL_SUSPENDED only on NORMAL -> SUSPENDED transition", () => {
    const prev = parseYsForecast(
      forecastHtml(NORMAL_TEXT, STANDBY_NORMAL_TEXT),
      "2026-03-04T04:20:00.000Z",
      "ys_forecast",
    ).weather;
    const curr = parseYsForecast(
      forecastHtml(SUSPEND_TEXT, "1\uB300\uAE30:O.K"),
      "2026-03-04T04:30:00.000Z",
      "ys_forecast",
    ).weather;

    const events = diffWeather(prev, curr, "ys_forecast", "2026-03-04T04:30:00.000Z");

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("ALL_SUSPENDED");
    expect(events[0]?.payload.dispatchTeamText).toContain("\uC804\uCCB4 \uB3C4\uC120 \uC911\uB2E8");
    expect(events[0]?.payload.standbyCallText).toContain("1\uB300\uAE30");
    expect(events[0]?.payload.normalizedReason).toContain("SUSPENDED");
  });

  it("emits no event when semantic state remains suspended", () => {
    const prev = parseYsForecast(
      forecastHtml(SUSPEND_SHORT_TEXT, "1\uB300\uAE30:O.K"),
      "2026-03-04T05:00:00.000Z",
      "ys_forecast",
    ).weather;
    const curr = parseYsForecast(
      forecastHtml(SUSPEND_TEXT, "2\uB300\uAE30:GD.KM"),
      "2026-03-04T05:10:00.000Z",
      "ys_forecast",
    ).weather;

    const events = diffWeather(prev, curr, "ys_forecast", "2026-03-04T05:10:00.000Z");

    expect(events).toHaveLength(0);
  });

  it("holds previous semantic state when current signal is ambiguous without emitting event", () => {
    const prev = parseYsForecast(
      forecastHtml(SUSPEND_SHORT_TEXT, "1\uB300\uAE30:O.K"),
      "2026-03-04T06:00:00.000Z",
      "ys_forecast",
    ).weather;
    const curr = parseYsForecast(
      forecastHtml(AMBIGUOUS_DISPATCH_TEXT, AMBIGUOUS_STANDBY_TEXT),
      "2026-03-04T06:10:00.000Z",
      "ys_forecast",
    ).weather;

    const events = diffWeather(prev, curr, "ys_forecast", "2026-03-04T06:10:00.000Z");

    expect(events).toHaveLength(0);
    expect(events.some((item) => item.type === "RESUMED")).toBe(false);
  });
});
