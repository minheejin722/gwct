import { describe, expect, it } from "vitest";
import type { EquipmentLoginStatus, VesselScheduleItem } from "@gwct/shared";
import { parseSeoulDate } from "../src/lib/time.js";
import { GwctCadenceGovernor } from "../src/services/scrapeCadence/governor.js";

function kst(raw: string): string {
  const parsed = parseSeoulDate(raw);
  if (!parsed) {
    throw new Error(`failed to parse KST date: ${raw}`);
  }
  return parsed;
}

function vessel(input: {
  eta: string;
  rowColor: "yellow" | "cyan" | "green" | "unknown";
  precedingGreenCount: number;
}): VesselScheduleItem {
  return {
    source: "gwct_schedule_list",
    vesselKey: "MENS-0001",
    vesselName: "MAERSK ENSHI",
    terminalVoyage: "MENS-0001",
    berth: "15",
    shippingLine: "MAE",
    route: "AE15",
    eta: input.eta,
    etb: null,
    ata: null,
    etd: null,
    atd: null,
    status: null,
    workStartAt: null,
    workEndAt: null,
    importCutoffAt: null,
    rawLabelMap: {
      _rowColor: input.rowColor,
      _precedingGreenCount: String(input.precedingGreenCount),
    },
    signature: `vessel:${input.eta}`,
    seenAt: kst("2026/03/10 03:00"),
  };
}

function equipmentRow(input: {
  equipmentId: string;
  operatorName?: string | null;
  loginText?: string | null;
  stopReason?: string | null;
}): EquipmentLoginStatus {
  return {
    source: "gwct_equipment_status",
    equipmentId: input.equipmentId,
    operatorName: input.operatorName ?? null,
    helperName: null,
    loginText: input.loginText ?? null,
    stopReason: input.stopReason ?? null,
    signature: `${input.equipmentId}:${input.operatorName || "none"}:${input.loginText || "none"}`,
    seenAt: kst("2026/03/10 03:00"),
  };
}

function workSummaryHtml(etaText: string, progress = "0%") {
  return `
    <html>
      <body>
        <table class="AA_list">
          <tr>
            <th>선석</th>
            <th>선박명</th>
            <th>입항일시</th>
            <th>진행률</th>
          </tr>
          <tr>
            <td>15</td>
            <td>MAERSK ENSHI</td>
            <td>${etaText}</td>
            <td>${progress}</td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

describe("GwctCadenceGovernor", () => {
  it("enters relaxed mode only after all early-off-duty signals align", () => {
    const governor = new GwctCadenceGovernor({ info() {} } as any);
    const seenAt = kst("2026/03/10 03:00");

    governor.observe({
      source: "gwct_schedule_list",
      seenAt,
      html: "",
      bundle: {
        vessels: [vessel({ eta: kst("2026/03/10 07:00"), rowColor: "yellow", precedingGreenCount: 2 })],
        cranes: [],
        equipment: [],
        yt: null,
        weather: null,
        diagnostics: [],
      },
    });

    governor.observe({
      source: "gwct_work_status",
      seenAt,
      html: workSummaryHtml("03/10 07:00"),
      bundle: {
        vessels: [],
        cranes: [],
        equipment: [],
        yt: null,
        weather: null,
        diagnostics: [],
      },
    });

    governor.observe({
      source: "gwct_equipment_status",
      seenAt,
      html: "",
      bundle: {
        vessels: [],
        cranes: [],
        equipment: [
          equipmentRow({ equipmentId: "GC181" }),
          equipmentRow({ equipmentId: "YT501" }),
          equipmentRow({ equipmentId: "TC215" }),
        ],
        yt: null,
        weather: null,
        diagnostics: [],
      },
    });

    expect(governor.snapshot().mode).toBe("fast");

    governor.observe({
      source: "gwct_equipment_status",
      seenAt: kst("2026/03/10 03:02"),
      html: "",
      bundle: {
        vessels: [],
        cranes: [],
        equipment: [
          equipmentRow({ equipmentId: "GC181" }),
          equipmentRow({ equipmentId: "YT501" }),
          equipmentRow({ equipmentId: "TC215" }),
        ],
        yt: null,
        weather: null,
        diagnostics: [],
      },
    });

    expect(governor.snapshot().mode).toBe("relaxed");
    expect(governor.intervalMsFor({ source: "gwct_schedule_list", url: "", intervalMs: 2000 }, new Date(seenAt))).toBe(600000);
    expect(governor.intervalMsFor({ source: "gwct_equipment_status", url: "", intervalMs: 2000 }, new Date(seenAt))).toBe(600000);
  });

  it("returns to fast mode and holds it until the next shift boundary when new login activity appears", () => {
    const governor = new GwctCadenceGovernor({ info() {} } as any);
    const relaxedSeenAt = kst("2026/03/10 03:00");

    governor.observe({
      source: "gwct_schedule_list",
      seenAt: relaxedSeenAt,
      html: "",
      bundle: {
        vessels: [vessel({ eta: kst("2026/03/10 07:00"), rowColor: "yellow", precedingGreenCount: 2 })],
        cranes: [],
        equipment: [],
        yt: null,
        weather: null,
        diagnostics: [],
      },
    });
    governor.observe({
      source: "gwct_work_status",
      seenAt: relaxedSeenAt,
      html: workSummaryHtml("03/10 07:00"),
      bundle: {
        vessels: [],
        cranes: [],
        equipment: [],
        yt: null,
        weather: null,
        diagnostics: [],
      },
    });
    governor.observe({
      source: "gwct_equipment_status",
      seenAt: relaxedSeenAt,
      html: "",
      bundle: {
        vessels: [],
        cranes: [],
        equipment: [equipmentRow({ equipmentId: "GC181" }), equipmentRow({ equipmentId: "YT501" })],
        yt: null,
        weather: null,
        diagnostics: [],
      },
    });
    governor.observe({
      source: "gwct_equipment_status",
      seenAt: kst("2026/03/10 03:02"),
      html: "",
      bundle: {
        vessels: [],
        cranes: [],
        equipment: [equipmentRow({ equipmentId: "GC181" }), equipmentRow({ equipmentId: "YT501" })],
        yt: null,
        weather: null,
        diagnostics: [],
      },
    });

    expect(governor.snapshot().mode).toBe("relaxed");

    governor.observe({
      source: "gwct_equipment_status",
      seenAt: kst("2026/03/10 03:05"),
      html: "",
      bundle: {
        vessels: [],
        cranes: [],
        equipment: [
          equipmentRow({ equipmentId: "GC181", operatorName: "홍길동", loginText: "03-10 03:05" }),
          equipmentRow({ equipmentId: "YT501" }),
        ],
        yt: null,
        weather: null,
        diagnostics: [],
      },
    });

    const snapshot = governor.snapshot();
    expect(snapshot.mode).toBe("fast");
    expect(snapshot.holdFastUntilShiftBoundaryAt).toBe(kst("2026/03/10 06:45"));

    governor.observe({
      source: "gwct_schedule_list",
      seenAt: kst("2026/03/10 03:06"),
      html: "",
      bundle: {
        vessels: [vessel({ eta: kst("2026/03/10 07:00"), rowColor: "yellow", precedingGreenCount: 2 })],
        cranes: [],
        equipment: [],
        yt: null,
        weather: null,
        diagnostics: [],
      },
    });

    expect(governor.intervalMsFor({ source: "gwct_schedule_list", url: "", intervalMs: 2000 }, new Date(kst("2026/03/10 03:06")))).toBe(
      2000,
    );
  });

  it("does not sleep past the next shift boundary while relaxed", () => {
    const governor = new GwctCadenceGovernor({ info() {} } as any);

    governor.observe({
      source: "gwct_schedule_list",
      seenAt: kst("2026/03/10 03:00"),
      html: "",
      bundle: {
        vessels: [vessel({ eta: kst("2026/03/10 07:00"), rowColor: "yellow", precedingGreenCount: 2 })],
        cranes: [],
        equipment: [],
        yt: null,
        weather: null,
        diagnostics: [],
      },
    });
    governor.observe({
      source: "gwct_work_status",
      seenAt: kst("2026/03/10 03:00"),
      html: workSummaryHtml("03/10 07:00"),
      bundle: {
        vessels: [],
        cranes: [],
        equipment: [],
        yt: null,
        weather: null,
        diagnostics: [],
      },
    });
    governor.observe({
      source: "gwct_equipment_status",
      seenAt: kst("2026/03/10 03:00"),
      html: "",
      bundle: {
        vessels: [],
        cranes: [],
        equipment: [equipmentRow({ equipmentId: "GC181" }), equipmentRow({ equipmentId: "YT501" })],
        yt: null,
        weather: null,
        diagnostics: [],
      },
    });
    governor.observe({
      source: "gwct_equipment_status",
      seenAt: kst("2026/03/10 03:02"),
      html: "",
      bundle: {
        vessels: [],
        cranes: [],
        equipment: [equipmentRow({ equipmentId: "GC181" }), equipmentRow({ equipmentId: "YT501" })],
        yt: null,
        weather: null,
        diagnostics: [],
      },
    });

    expect(governor.snapshot().mode).toBe("relaxed");
    expect(
      governor.intervalMsFor(
        { source: "gwct_schedule_list", url: "", intervalMs: 2000 },
        new Date(kst("2026/03/10 06:40")),
      ),
    ).toBe(300000);
  });
});
