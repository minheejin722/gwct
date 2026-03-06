import { describe, expect, it } from "vitest";
import type { AlertEvent, VesselScheduleItem } from "@gwct/shared";
import { buildVesselLiveRows } from "../src/services/vessels/liveRows.js";

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
      deltaMinutes: 120,
      direction: "later",
      crossedDate: true,
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
      [etaAlert("SWSI-0002", "2026-03-06T14:00", "2026-03-07T16:00", "내일로 26시간 0분 더 늦게 입항 예정입니다.")],
    );

    expect(result[0]?.latestEtaChange).toMatchObject({
      eventId: "evt:SWSI-0002",
      previousEtaDisplay: "2026/03/06 14:00",
      currentEtaDisplay: "2026/03/07 16:00",
      humanMessage: "내일로 26시간 0분 더 늦게 입항 예정입니다.",
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
      "종전보다 1시간 0분 더 늦게 입항 예정입니다.",
    );
    newestAlert.occurredAt = "2026-03-07T00:06:00.000Z";

    const olderAlert = etaAlert(
      "SWSI-0002",
      "2026-03-06T14:00",
      "2026-03-06T15:00",
      "종전보다 1시간 0분 더 늦게 입항 예정입니다.",
    );
    olderAlert.id = "evt:SWSI-0002:older";
    olderAlert.occurredAt = "2026-03-07T00:05:00.000Z";

    const result = buildVesselLiveRows(rows, [newestAlert, olderAlert]);

    expect(result[0]?.latestEtaChange).toMatchObject({
      eventId: "evt:SWSI-0002",
      adjustmentCount: 2,
      humanMessage: "종전보다 1시간 0분 더 늦게 입항 예정입니다. 2번째 ETA 조정",
    });
  });
});
