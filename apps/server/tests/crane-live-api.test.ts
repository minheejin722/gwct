import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearGcAssignmentStateForTest } from "../src/services/gc/assignmentStore.js";

if (process.env.MODE !== "live" && process.env.MODE !== "fixture") {
  process.env.MODE = "fixture";
}

const loadGcLatestSnapshotMock = vi.fn();
const loadEquipmentLatestSnapshotMock = vi.fn();

vi.mock("../src/services/gc/latestStore.js", () => ({
  loadGcLatestSnapshot: loadGcLatestSnapshotMock,
}));

vi.mock("../src/services/equipment/latestStore.js", () => ({
  loadEquipmentLatestSnapshot: loadEquipmentLatestSnapshotMock,
}));

function workRow(seenAt: string, vesselName: string, totalRemaining: number) {
  return {
    source: "gwct_work_status" as const,
    craneId: "GC184",
    vesselName,
    dischargeDone: null,
    loadDone: null,
    dischargeRemaining: totalRemaining,
    loadRemaining: 0,
    totalRemaining,
    progressPercent: null,
    signature: `${seenAt}:${vesselName}:${totalRemaining}`,
    seenAt,
  };
}

const createdApps: Array<Awaited<ReturnType<typeof Fastify>>> = [];

describe.sequential("crane live api", () => {
  afterEach(async () => {
    while (createdApps.length) {
      const app = createdApps.pop();
      if (app) {
        await app.close();
      }
    }
    await clearGcAssignmentStateForTest();
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("backfills multi-vessel assignment for /api/cranes/live and keeps it after DELETE /api/events", async () => {
    await clearGcAssignmentStateForTest();

    loadGcLatestSnapshotMock.mockResolvedValue({
      source: "gwct_gc_remaining",
      sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=F&s=A",
      capturedAt: "2026-03-07T06:40:10.743Z",
      items: [
        { gc: 184, dischargeRemaining: 171, loadRemaining: 175, remainingSubtotal: 346 },
      ],
    });

    loadEquipmentLatestSnapshotMock.mockResolvedValue({
      source: "gwct_equipment_status",
      sourceUrl: "http://www.gwct.co.kr:8080/dashboard/?m=D&s=A",
      capturedAt: "2026-03-07T06:40:10.743Z",
      ytCount: 0,
      ytKnown: 0,
      ytUnits: [],
      gcStates: [
        {
          gcNo: 184,
          equipmentId: "GC184",
          driverName: "Kim",
          hkName: "Lee",
          loginTime: "03-07 15:00",
          stopReason: null,
        },
      ],
    });

    const repo = {
      async getLatestCraneStatuses() {
        return [
          workRow("2026-03-07T06:40:10.743Z", "MAERSK SALTORO", 179),
          workRow("2026-03-07T06:40:10.743Z", "CMA CGM CORTE REAL", 167),
        ];
      },
      async getLatestCraneStatusSnapshotGroups() {
        return [
          {
            seenAt: "2026-03-07T06:40:10.743Z",
            items: [
              workRow("2026-03-07T06:40:10.743Z", "MAERSK SALTORO", 179),
              workRow("2026-03-07T06:40:10.743Z", "CMA CGM CORTE REAL", 167),
            ],
          },
          {
            seenAt: "2026-03-07T06:39:03.339Z",
            items: [
              workRow("2026-03-07T06:39:03.339Z", "MAERSK SALTORO", 180),
              workRow("2026-03-07T06:39:03.339Z", "CMA CGM CORTE REAL", 167),
            ],
          },
        ];
      },
      async clearEventHistory() {
        return {
          alertEvents: 3,
          vesselScheduleChangeEvents: 0,
          equipmentLoginEvents: 0,
          weatherAlertEvents: 0,
          notificationLogs: 0,
        };
      },
    };

    const app = Fastify();
    createdApps.push(app);

    const { registerRoutes } = await import("../src/routes/api.js");
    await registerRoutes(app, {
      repo: repo as any,
      monitorService: {} as any,
      sseHub: { broadcast() {} } as any,
      cleanupService: {
        async runCleanupOnce() {
          return {};
        },
      } as any,
    });

    const before = await app.inject({ method: "GET", url: "/api/cranes/live" });
    expect(before.statusCode).toBe(200);
    const beforePayload = before.json() as {
      count: number;
      items: Array<{ craneId: string; vesselName: string | null; workState: string }>;
    };
    expect(beforePayload.count).toBe(11);
    expect(
      beforePayload.items.find((item) => item.craneId === "GC184" && item.vesselName === "MAERSK SALTORO"),
    ).toMatchObject({
      craneId: "GC184",
      vesselName: "MAERSK SALTORO",
      workState: "active",
    });
    expect(
      beforePayload.items.find(
        (item) => item.craneId === "GC184" && item.vesselName === "CMA CGM CORTE REAL",
      ),
    ).toMatchObject({
      craneId: "GC184",
      vesselName: "CMA CGM CORTE REAL",
      workState: "scheduled",
    });

    const clear = await app.inject({ method: "DELETE", url: "/api/events" });
    expect(clear.statusCode).toBe(200);

    const after = await app.inject({ method: "GET", url: "/api/cranes/live" });
    expect(after.statusCode).toBe(200);
    const afterPayload = after.json() as {
      items: Array<{ craneId: string; vesselName: string | null; workState: string }>;
    };
    expect(
      afterPayload.items.find((item) => item.craneId === "GC184" && item.vesselName === "MAERSK SALTORO"),
    ).toMatchObject({
      craneId: "GC184",
      vesselName: "MAERSK SALTORO",
      workState: "active",
    });
    expect(
      afterPayload.items.find(
        (item) => item.craneId === "GC184" && item.vesselName === "CMA CGM CORTE REAL",
      ),
    ).toMatchObject({
      craneId: "GC184",
      vesselName: "CMA CGM CORTE REAL",
      workState: "scheduled",
    });
  });
});
