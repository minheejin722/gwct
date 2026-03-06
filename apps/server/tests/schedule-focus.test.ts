import { describe, expect, it } from "vitest";
import { EVENT_TO_DEEPLINK } from "@gwct/shared";
import { detectGwctEtaChangedEvents } from "../src/engine/diff.js";
import { parseGwctScheduleList } from "../src/parsers/gwct.js";

function rowHtml(
  rowClass: string,
  voyage: string,
  vesselName: string,
  eta: string,
  etd = "2026/03/02 00:00",
): string {
  return `<tr class="${rowClass}">
<td>15</td><td>${voyage}</td><td>${vesselName}</td><td>S</td><td>HAS</td>
<td>${eta}</td><td>${etd}</td><td></td><td></td><td></td><td>0</td><td>0</td><td>0</td><td></td><td>NTX</td>
</tr>`;
}

function wrapTable(rows: string): string {
  return `<html><body><table class="AA_list">
<tr><th>선석</th><th>모선항차</th><th>선박명</th><th>접안</th><th>선사</th><th>입항 일시</th><th>출항 일시</th><th>작업 시작일시</th><th>작업 완료일시</th><th>반입 마감일시</th><th>양하</th><th>선적</th><th>S/H</th><th>전배</th><th>항로</th></tr>
${rows}
</table></body></html>`;
}

describe("schedule focus parser and eta diff", () => {
  it("starts from first yellow row and keeps only 11 non-green rows", () => {
    const greens = [
      rowHtml("bg_closed", "G-0001", "GREEN1", "2026/03/01 00:10"),
      rowHtml("bg_closed", "G-0002", "GREEN2", "2026/03/01 00:20"),
      rowHtml("bg_closed", "G-0003", "GREEN3", "2026/03/01 00:30"),
    ];
    const yellows = [
      rowHtml("bg_on", "Y-0001", "YELLOW1", "2026/03/01 01:00"),
      rowHtml("bg_on", "Y-0002", "YELLOW2", "2026/03/01 01:10"),
      rowHtml("bg_on", "Y-0003", "YELLOW3", "2026/03/01 01:20"),
    ];
    const cyans = Array.from({ length: 10 }, (_, i) =>
      rowHtml("bg_yet", `C-00${i + 1}`, `CYAN${i + 1}`, `2026/03/01 ${String(i + 2).padStart(2, "0")}:00`),
    );

    const html = wrapTable([...greens, ...yellows, ...cyans].join("\n"));
    const bundle = parseGwctScheduleList(html, "2026-03-01T12:00:00.000Z", "gwct_schedule_list");

    expect(bundle.vessels).toHaveLength(11);
    expect(bundle.vessels[0]?.terminalVoyage).toBe("Y-0001");
    expect(bundle.vessels[0]?.eta).toBe("2026-02-28T16:00:00.000Z");
    expect(bundle.vessels[0]?.etd).toBe("2026-03-01T15:00:00.000Z");
    expect(bundle.vessels[10]?.terminalVoyage).toBe("C-008");
    expect(bundle.vessels.every((row) => row.rawLabelMap._rowColor !== "green")).toBe(true);
  });

  it("falls back to first non-green row when yellow does not exist", () => {
    const greens = [
      rowHtml("bg_closed", "G-0001", "GREEN1", "2026/03/01 00:10"),
      rowHtml("bg_closed", "G-0002", "GREEN2", "2026/03/01 00:20"),
    ];
    const cyans = Array.from({ length: 12 }, (_, i) =>
      rowHtml("bg_yet", `N-00${i + 1}`, `NEXT${i + 1}`, `2026/03/01 ${String(i + 3).padStart(2, "0")}:00`),
    );

    const html = wrapTable([...greens, ...cyans].join("\n"));
    const bundle = parseGwctScheduleList(html, "2026-03-01T12:00:00.000Z", "gwct_schedule_list");

    expect(bundle.vessels).toHaveLength(11);
    expect(bundle.vessels[0]?.terminalVoyage).toBe("N-001");
    expect(bundle.vessels[0]?.rawLabelMap._watchStartReason).toBe("first_non_green");
  });

  it("emits gwct_eta_changed only when same voyage ETA changes", () => {
    const beforeHtml = wrapTable(
      [
        rowHtml("bg_on", "Y-0001", "YELLOW1", "2026/03/01 02:00"),
        rowHtml("bg_on", "Y-0002", "YELLOW2", "2026/03/01 03:00"),
        rowHtml("bg_yet", "C-0001", "CYAN1", "2026/03/01 04:00"),
      ].join("\n"),
    );
    const afterHtml = wrapTable(
      [
        rowHtml("bg_on", "Y-0001", "YELLOW1", "2026/03/01 02:30"),
        rowHtml("bg_on", "Y-0002", "YELLOW2", "2026/03/01 03:00"),
        rowHtml("bg_yet", "C-0001", "CYAN1", "2026/03/01 04:00"),
      ].join("\n"),
    );

    const prev = parseGwctScheduleList(beforeHtml, "2026-03-01T12:00:00.000Z", "gwct_schedule_list").vessels;
    const curr = parseGwctScheduleList(afterHtml, "2026-03-01T12:01:00.000Z", "gwct_schedule_list").vessels;

    const events = detectGwctEtaChangedEvents(prev, curr, "gwct_schedule_list", "2026-03-01T12:01:00.000Z", {
      sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=H&s=A",
    });

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("gwct_eta_changed");
    expect(events[0]?.payload.voyage).toBe("Y-0001");
    expect(EVENT_TO_DEEPLINK[events[0]!.type]).toBe("vessels");
  });

  it("does not emit when watch window composition changes with new voyage", () => {
    const beforeHtml = wrapTable(
      [
        rowHtml("bg_on", "Y-0001", "YELLOW1", "2026/03/01 02:00"),
        rowHtml("bg_on", "Y-0002", "YELLOW2", "2026/03/01 03:00"),
      ].join("\n"),
    );
    const afterHtml = wrapTable(
      [
        rowHtml("bg_on", "Y-0001", "YELLOW1", "2026/03/01 02:00"),
        rowHtml("bg_on", "NEW-0001", "NEWCOMER", "2026/03/01 03:30"),
      ].join("\n"),
    );

    const prev = parseGwctScheduleList(beforeHtml, "2026-03-01T12:00:00.000Z", "gwct_schedule_list").vessels;
    const curr = parseGwctScheduleList(afterHtml, "2026-03-01T12:01:00.000Z", "gwct_schedule_list").vessels;

    const events = detectGwctEtaChangedEvents(prev, curr, "gwct_schedule_list", "2026-03-01T12:01:00.000Z", {
      sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=H&s=A",
    });

    expect(events).toHaveLength(0);
  });
});
