import { describe, expect, it } from "vitest";
import { parseYsForecast } from "../src/parsers/ys.js";

describe("YS forecast parser", () => {
  it("detects all suspended in dispatch team duty text", () => {
    const html = `<table><tr><td class="bg">사다리위치</td><td class="datatype1" colspan="3">기상악화</td><td class="bg">배선팀근무</td><td class="datatype1">전체 도선 중단 (All Pilotage Suspended</td></tr></table>`;
    const bundle = parseYsForecast(html, new Date().toISOString(), "ys_forecast");

    expect(bundle.weather?.suspensionState).toBe("all");
    expect(bundle.weather?.dispatchTeamDutyText).toContain("전체 도선 중단");
  });
});
