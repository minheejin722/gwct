import { describe, expect, it } from "vitest";
import { parseYsForecast } from "../src/parsers/ys.js";

describe("YS forecast parser", () => {
  it("classifies suspended when dispatch/standby combined signal includes weather suspension", () => {
    const html = `<table><tr><td class="bg">배선팀근무</td><td class="datatype1">13시30분부로 기상 악화로 인하여 전체 도선 중단.</td><td class="bg">대기호출자</td><td class="datatype1">■1대기:O.K</td></tr></table>`;
    const bundle = parseYsForecast(html, new Date().toISOString(), "ys_forecast");

    expect(bundle.weather?.suspensionState).toBe("all");
    expect(bundle.weather?.semanticState).toBe("SUSPENDED");
    expect(bundle.weather?.dispatchTeamDutyText).toContain("전체 도선 중단");
    expect(bundle.weather?.matchedKeywords.some((item) => item.includes("기상 악화"))).toBe(true);
  });

  it("classifies normal from standby indicators when suspend keyword is absent", () => {
    const html = `<table><tr><td class="bg">배선팀근무</td><td class="datatype1">평시 배선</td><td class="bg">대기호출자</td><td class="datatype1">■1대기:O.K ■2대기:GD.KM ■휴가:DJ</td></tr></table>`;
    const bundle = parseYsForecast(html, new Date().toISOString(), "ys_forecast");

    expect(bundle.weather?.suspensionState).toBe("none");
    expect(bundle.weather?.semanticState).toBe("NORMAL");
    expect(bundle.weather?.standbyCallText).toContain("1대기");
  });
});
