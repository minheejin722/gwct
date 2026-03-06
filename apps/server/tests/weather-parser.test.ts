import { describe, expect, it } from "vitest";
import { parseYsForecast, parseYsNews, parseYsNotice } from "../src/parsers/ys.js";

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

  it("classifies suspended when standby call text alone carries a suspension signal", () => {
    const html = `<table><tr><td class="bg">배선팀근무</td><td class="datatype1">■홍상철.윤지환</td><td class="bg">대기호출자</td><td class="datatype1">■13시30분부로 기상 악화로 인하여 전체 도선 중단</td></tr></table>`;
    const bundle = parseYsForecast(html, new Date().toISOString(), "ys_forecast");

    expect(bundle.weather?.semanticState).toBe("SUSPENDED");
    expect(bundle.weather?.matchedKeywords).toContain("standby:전체 도선 중단");
  });
});

describe("YS board parser", () => {
  it("detects recent suspension headlines from board lists instead of only first pinned notice", () => {
    const html = `
      <table>
        <tr><th>번호</th><th>제목</th><th>작성자</th><th>등록일</th></tr>
        <tr><td>공지</td><td>도선료 및 도선선료 입금 계좌 분리 안내</td><td>운영자</td><td>2026-03-07</td></tr>
        <tr><td>공지</td><td>VHF 채널 안내</td><td>운영자</td><td>2026-03-07</td></tr>
        <tr><td>443</td><td>기상 악화로 인한 ALL PILOTAGE SUSPENDED 안내</td><td>운영자</td><td>2026-03-07</td></tr>
      </table>
    `;

    const bundle = parseYsNotice(html, "2026-03-07T04:45:00.000Z", "ys_notice");

    expect(bundle.weather?.semanticState).toBe("SUSPENDED");
    expect(bundle.weather?.noticeHeadline).toContain("ALL PILOTAGE SUSPENDED");
  });

  it("ignores stale board suspension titles so old notice history does not keep port closed forever", () => {
    const html = `
      <table>
        <tr><th>번호</th><th>제목</th><th>작성자</th><th>등록일</th></tr>
        <tr><td>440</td><td>기상 악화로 전체 도선 중단</td><td>운영자</td><td>2026-03-01</td></tr>
        <tr><td>439</td><td>일반 공지</td><td>운영자</td><td>2026-03-01</td></tr>
      </table>
    `;

    const bundle = parseYsNews(html, "2026-03-07T04:45:00.000Z", "ys_news");

    expect(bundle.weather?.semanticState).toBe("UNKNOWN");
    expect(bundle.weather?.suspensionState).toBe("none");
  });
});
