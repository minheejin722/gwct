import { describe, expect, it, vi } from "vitest";
import type { AlertEventInput } from "../src/db/repository.js";

function buildEtaEvent(
  humanMessage: string,
  overrides?: Partial<{
    beforeValue: string;
    afterValue: string;
    deltaMinutes: number;
    direction: "earlier" | "later";
    crossedDate: boolean;
  }>,
): AlertEventInput {
  const beforeValue = overrides?.beforeValue || "2026-03-07T14:00";
  const afterValue = overrides?.afterValue || "2026-03-07T16:00";
  return {
    category: "VESSEL",
    type: "gwct_eta_changed",
    source: "gwct_schedule_list",
    dedupeKey: "gwct:eta:SWSI-0002:2026-03-07T16:00",
    title: "ETA 변경 (SWSI-0002)",
    message: `SAWASDEE SIRIUS ${humanMessage}`,
    beforeValue,
    afterValue,
    payload: {
      type: "gwct_eta_changed",
      voyage: "SWSI-0002",
      vesselKey: "SWSI-0002",
      vesselName: "SAWASDEE SIRIUS",
      previousEta: beforeValue,
      currentEta: afterValue,
      deltaMinutes: overrides?.deltaMinutes ?? 120,
      direction: overrides?.direction ?? "later",
      crossedDate: overrides?.crossedDate ?? false,
      humanMessage,
      indexInWatchWindow: 1,
      trackingCount: 11,
      sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=H&s=A",
      capturedAt: "2026-03-07T00:00:00.000Z",
    },
    occurredAt: "2026-03-07T00:00:00.000Z",
  };
}

describe("monitor service ETA adjustment decoration", () => {
  it("appends nth adjustment label based on prior ETA change count", async () => {
    process.env.MODE = "live";
    const { MonitorService } = await import("../src/services/monitorService.js");
    const repo = {
      countGwctEtaAdjustments: vi.fn().mockResolvedValue(2),
    } as any;
    const service = new MonitorService(repo, {} as any, {} as any, { broadcast() {} } as any, { info() {}, debug() {} } as any);

    const prepared = await (service as any).decorateEtaAdjustmentEvent(
      buildEtaEvent("종전보다 2시간 더 늦게 입항 예정입니다."),
    );

    expect(repo.countGwctEtaAdjustments).toHaveBeenCalledWith("SWSI-0002");
    expect(prepared.payload.adjustmentCount).toBe(3);
    expect(prepared.payload.humanMessage).toBe("종전보다 2시간 더 늦게 입항 예정입니다. 3번째 조정");
    expect(prepared.message).toBe("SAWASDEE SIRIUS 종전보다 2시간 더 늦게 입항 예정입니다. 3번째 조정");
  });

  it("keeps first ETA change message unchanged", async () => {
    process.env.MODE = "live";
    const { MonitorService } = await import("../src/services/monitorService.js");
    const repo = {
      countGwctEtaAdjustments: vi.fn().mockResolvedValue(0),
    } as any;
    const service = new MonitorService(repo, {} as any, {} as any, { broadcast() {} } as any, { info() {}, debug() {} } as any);

    const prepared = await (service as any).decorateEtaAdjustmentEvent(
      buildEtaEvent("종전보다 45분 더 일찍 입항 예정입니다.", {
        beforeValue: "2026-03-07T14:00",
        afterValue: "2026-03-07T13:15",
        deltaMinutes: -45,
        direction: "earlier",
        crossedDate: false,
      }),
    );

    expect(prepared.payload.adjustmentCount).toBe(1);
    expect(prepared.payload.humanMessage).toBe("종전보다 45분 더 일찍 입항 예정입니다.");
  });

  it("normalizes older cross-day wording before appending adjustment text", async () => {
    process.env.MODE = "live";
    const { MonitorService } = await import("../src/services/monitorService.js");
    const repo = {
      countGwctEtaAdjustments: vi.fn().mockResolvedValue(1),
    } as any;
    const service = new MonitorService(repo, {} as any, {} as any, { broadcast() {} } as any, { info() {}, debug() {} } as any);

    const prepared = await (service as any).decorateEtaAdjustmentEvent(
      buildEtaEvent("어제로 2시간 더 일찍 입항 예정입니다."),
    );

    expect(prepared.payload.adjustmentCount).toBe(2);
    expect(prepared.payload.humanMessage).toBe("종전보다 2시간 더 늦게 입항 예정입니다. 2번째 조정");
    expect(prepared.message).toBe("SAWASDEE SIRIUS 종전보다 2시간 더 늦게 입항 예정입니다. 2번째 조정");
  });
});
