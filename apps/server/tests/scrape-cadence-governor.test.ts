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
  allRowsCyan?: boolean;
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
      _allRowsCyan: String(input.allRowsCyan === true),
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

function currentWorkSummaryHtml(etaText: string, progress = "0%") {
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

function emptyCurrentWorkSummaryHtml() {
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
      html: currentWorkSummaryHtml("03/10 07:00"),
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
    expect(governor.intervalMsFor({ source: "gwct_schedule_list", url: "", intervalMs: 2000 }, new Date(seenAt))).toBe(30000);
    expect(governor.intervalMsFor({ source: "gwct_equipment_status", url: "", intervalMs: 2000 }, new Date(seenAt))).toBe(600000);
  });

  it("treats an all-cyan schedule list as schedule-ready for relaxed mode", () => {
    const governor = new GwctCadenceGovernor({ info() {} } as any);
    const seenAt = kst("2026/03/10 03:00");

    governor.observe({
      source: "gwct_schedule_list",
      seenAt,
      html: "",
      bundle: {
        vessels: [
          vessel({ eta: kst("2026/03/10 07:00"), rowColor: "cyan", precedingGreenCount: 0, allRowsCyan: true }),
          vessel({ eta: kst("2026/03/10 08:00"), rowColor: "cyan", precedingGreenCount: 0, allRowsCyan: true }),
        ],
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
      html: currentWorkSummaryHtml("03/10 07:00"),
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
        equipment: [equipmentRow({ equipmentId: "GC181" }), equipmentRow({ equipmentId: "YT501" })],
        yt: null,
        weather: null,
        diagnostics: [],
      },
    });

    expect(governor.snapshot().mode).toBe("fast");
    expect(governor.snapshot().scheduleSignal.allRowsCyan).toBe(true);

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
  });

  it("treats an empty recognized work table as no-work for relaxed mode", () => {
    const governor = new GwctCadenceGovernor({ info() {} } as any);
    const seenAt = kst("2026/03/10 03:00");

    governor.observe({
      source: "gwct_schedule_list",
      seenAt,
      html: "",
      bundle: {
        vessels: [vessel({ eta: kst("2026/03/10 07:00"), rowColor: "cyan", precedingGreenCount: 0, allRowsCyan: true })],
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
      html: emptyCurrentWorkSummaryHtml(),
      bundle: {
        vessels: [],
        cranes: [],
        equipment: [],
        yt: null,
        weather: null,
        diagnostics: [],
      },
    });

    expect(governor.snapshot().workSignal.ready).toBe(true);
    expect(governor.snapshot().workSignal.rowCount).toBe(0);

    governor.observe({
      source: "gwct_equipment_status",
      seenAt,
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
  });

  it("ignores support-equipment logins when YT logins are absent", () => {
    const governor = new GwctCadenceGovernor({ info() {} } as any);
    const seenAt = kst("2026/03/10 03:00");

    governor.observe({
      source: "gwct_schedule_list",
      seenAt,
      html: "",
      bundle: {
        vessels: [vessel({ eta: kst("2026/03/10 07:00"), rowColor: "cyan", precedingGreenCount: 0, allRowsCyan: true })],
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
      html: emptyCurrentWorkSummaryHtml(),
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
          equipmentRow({ equipmentId: "LEASE1", operatorName: "A", loginText: "03-10 03:00" }),
          equipmentRow({ equipmentId: "TC215", operatorName: "B", loginText: "03-10 03:00" }),
          equipmentRow({ equipmentId: "TH12", operatorName: "C", loginText: "03-10 03:00" }),
        ],
        yt: null,
        weather: null,
        diagnostics: [],
      },
    });

    expect(governor.snapshot().mode).toBe("fast");
    expect(governor.snapshot().equipmentSignal.ytActiveCount).toBe(0);
    expect(governor.snapshot().equipmentSignal.relevantActiveCount).toBe(0);

    governor.observe({
      source: "gwct_equipment_status",
      seenAt: kst("2026/03/10 03:02"),
      html: "",
      bundle: {
        vessels: [],
        cranes: [],
        equipment: [
          equipmentRow({ equipmentId: "REPAIR2", operatorName: "D", loginText: "03-10 03:02" }),
          equipmentRow({ equipmentId: "RS5", operatorName: "E", loginText: "03-10 03:02" }),
        ],
        yt: null,
        weather: null,
        diagnostics: [],
      },
    });

    expect(governor.snapshot().mode).toBe("relaxed");
    expect(governor.snapshot().equipmentSignal.supportActiveCount).toBe(2);
    expect(governor.snapshot().equipmentSignal.relevantActiveCount).toBe(0);

    governor.observe({
      source: "gwct_equipment_status",
      seenAt: kst("2026/03/10 03:04"),
      html: "",
      bundle: {
        vessels: [],
        cranes: [],
        equipment: [
          equipmentRow({ equipmentId: "TC215", operatorName: "B", loginText: "03-10 03:04" }),
          equipmentRow({ equipmentId: "TH12", operatorName: "C", loginText: "03-10 03:04" }),
          equipmentRow({ equipmentId: "LEASE1", operatorName: "F", loginText: "03-10 03:04" }),
        ],
        yt: null,
        weather: null,
        diagnostics: [],
      },
    });

    expect(governor.snapshot().mode).toBe("relaxed");
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
      html: currentWorkSummaryHtml("03/10 07:00"),
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
      html: currentWorkSummaryHtml("03/10 07:00"),
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
    ).toBe(30000);
    expect(
      governor.intervalMsFor(
        { source: "gwct_equipment_status", url: "", intervalMs: 2000 },
        new Date(kst("2026/03/10 06:40")),
      ),
    ).toBe(300000);
  });
});
