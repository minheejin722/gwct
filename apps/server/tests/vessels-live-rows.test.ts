import { describe, expect, it } from "vitest";
import type { AlertEvent, VesselScheduleItem } from "@gwct/shared";
import { buildVesselLiveRows } from "../src/services/vessels/liveRows.js";

function toUtcMinutes(value: string): number {
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day, hour, minute) / 60000);
}

function toUtcDateIndex(value: string): number {
  const [datePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function vessel(input: {
  vesselKey: string;
  vesselName: string;
  voyage: string;
  eta: string;
  etd: string;
  watchIndex: number;
  rowColor: "yellow" | "cyan";
}): VesselScheduleItem {
  return {
    source: "gwct_schedule_list",
    vesselKey: input.vesselKey,
    vesselName: input.vesselName,
    terminalVoyage: input.voyage,
    berth: "14",
    shippingLine: "SKR",
    route: "KXS1",
    eta: input.eta,
    etb: null,
    ata: null,
    etd: input.etd,
    atd: null,
    status: null,
    workStartAt: null,
    workEndAt: null,
    importCutoffAt: null,
    rawLabelMap: {
      _watchIndex: String(input.watchIndex),
      _rowColor: input.rowColor,
    },
    signature: `${input.vesselKey}:${input.watchIndex}`,
    seenAt: "2026-03-07T00:00:00.000Z",
  };
}

function etaAlert(vesselKey: string, previousEta: string, currentEta: string, humanMessage: string): AlertEvent {
  const deltaMinutes = toUtcMinutes(currentEta) - toUtcMinutes(previousEta);
  return {
    id: `evt:${vesselKey}`,
    category: "VESSEL",
    type: "gwct_eta_changed",
    dedupeKey: `eta:${vesselKey}:${currentEta}`,
    title: `ETA 변경 (${vesselKey})`,
    message: `${vesselKey} ${humanMessage}`,
    beforeValue: previousEta,
    afterValue: currentEta,
    payload: {
      vesselKey,
      previousEta,
      currentEta,
      deltaMinutes,
      direction: deltaMinutes < 0 ? "earlier" : "later",
      crossedDate: toUtcDateIndex(currentEta) !== toUtcDateIndex(previousEta),
      humanMessage,
    },
    occurredAt: "2026-03-07T00:05:00.000Z",
  };
}

describe("vessel live rows", () => {
  it("sorts by watch index, keeps 11 rows, and formats KST ETA/ETD displays", () => {
    const rows = Array.from({ length: 12 }, (_, index) =>
      vessel({
        vesselKey: `VOY-${index + 1}`,
        vesselName: `VESSEL ${index + 1}`,
        voyage: `VOY-${index + 1}`,
        eta: `2026-03-0${(index % 3) + 7}T05:00:00.000Z`,
        etd: `2026-03-0${(index % 3) + 7}T17:00:00.000Z`,
        watchIndex: 12 - index,
        rowColor: index < 3 ? "yellow" : "cyan",
      }),
    );

    const result = buildVesselLiveRows(rows, []);

    expect(result).toHaveLength(11);
    expect(result[0]?.watchIndex).toBe(1);
    expect(result[0]?.vesselKey).toBe("VOY-12");
    expect(result[0]?.etaDisplay).toBe("2026/03/09 14:00");
    expect(result[0]?.etdDisplay).toBe("2026/03/10 02:00");
    expect(result[0]?.rowColor).toBe("cyan");
  });

  it("attaches the latest eta change message and formatted previous/current ETA", () => {
    const rows = [
      vessel({
        vesselKey: "SWSI-0002",
        vesselName: "SAWASDEE SIRIUS",
        voyage: "SWSI-0002",
        eta: "2026-03-06T05:00:00.000Z",
        etd: "2026-03-06T17:00:00.000Z",
        watchIndex: 1,
        rowColor: "yellow",
      }),
    ];

    const result = buildVesselLiveRows(
      rows,
      [etaAlert("SWSI-0002", "2026-03-06T14:00", "2026-03-07T16:00", "종전보다 26시간 더 늦게 입항 예정입니다.")],
    );

    expect(result[0]?.latestEtaChange).toMatchObject({
      eventId: "evt:SWSI-0002",
      previousEtaDisplay: "2026/03/06 14:00",
      currentEtaDisplay: "2026/03/07 16:00",
      humanMessage: "종전보다 26시간 더 늦게 입항 예정입니다.",
    });
  });

  it("shows nth eta adjustment label from recent eta change history", () => {
    const rows = [
      vessel({
        vesselKey: "SWSI-0002",
        vesselName: "SAWASDEE SIRIUS",
        voyage: "SWSI-0002",
        eta: "2026-03-06T07:00:00.000Z",
        etd: "2026-03-06T17:00:00.000Z",
        watchIndex: 1,
        rowColor: "yellow",
      }),
    ];

    const newestAlert = etaAlert(
      "SWSI-0002",
      "2026-03-06T15:00",
      "2026-03-06T16:00",
      "종전보다 1시간 더 늦게 입항 예정입니다.",
    );
    newestAlert.occurredAt = "2026-03-07T00:06:00.000Z";

    const olderAlert = etaAlert(
      "SWSI-0002",
      "2026-03-06T14:00",
      "2026-03-06T15:00",
      "종전보다 1시간 더 늦게 입항 예정입니다.",
    );
    olderAlert.id = "evt:SWSI-0002:older";
    olderAlert.occurredAt = "2026-03-07T00:05:00.000Z";

    const result = buildVesselLiveRows(rows, [newestAlert, olderAlert]);

    expect(result[0]?.latestEtaChange).toMatchObject({
      eventId: "evt:SWSI-0002",
      adjustmentCount: 2,
      humanMessage: "종전보다 1시간 더 늦게 입항 예정입니다. 2번째 조정",
    });
  });

  it("normalizes persisted cross-day wording back to 종전보다 when reading eta adjustment records", () => {
    const rows = [
      vessel({
        vesselKey: "SWAL-0003",
        vesselName: "SAWASDEE ALTAIR",
        voyage: "SWAL-0003",
        eta: "2026-03-10T06:30:00.000Z",
        etd: "2026-03-10T17:00:00.000Z",
        watchIndex: 1,
        rowColor: "yellow",
      }),
    ];

    const result = buildVesselLiveRows(rows, [], [
      {
        vesselKey: "SWAL-0003",
        vesselName: "SAWASDEE ALTAIR",
        voyage: "SWAL-0003",
        occurredAt: "2026-03-11T00:05:00.000Z",
        previousEta: "2026-03-11T02:00",
        currentEta: "2026-03-10T00:30",
        deltaMinutes: -90,
        direction: "earlier",
        crossedDate: true,
        humanMessage: "어제로 1시간 30분 더 일찍 입항 예정입니다.",
        adjustmentCount: 1,
      },
    ]);

    expect(result[0]?.latestEtaChange).toMatchObject({
      humanMessage: "종전보다 1시간 30분 더 일찍 입항 예정입니다.",
      crossedDate: true,
      deltaMinutes: -90,
    });
  });
});
