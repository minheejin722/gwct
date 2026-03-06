import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { clearVesselEtaAdjustmentRecordsForTest, saveVesselEtaAdjustmentRecord } from "../src/services/vessels/etaAdjustmentStore.js";

if (process.env.MODE !== "live" && process.env.MODE !== "fixture") {
  process.env.MODE = "fixture";
}

interface StubAlertRow {
  id: string;
  category: string;
  type: string;
  dedupeKey: string;
  title: string;
  message: string;
  beforeValue: string | null;
  afterValue: string | null;
  payload: Record<string, unknown>;
  occurredAt: Date;
}

interface StubState {
  alerts: StubAlertRow[];
  baselineFingerprint: string;
}

function makeVesselRow() {
  return {
    source: "gwct_schedule_list",
    vesselKey: "SWSI-0002",
    vesselName: "SAWASDEE SIRIUS",
    terminalVoyage: "SWSI-0002",
    berth: "14",
    shippingLine: "SKR",
    route: "KXS1",
    eta: "2026-03-07T07:00:00.000Z",
    etb: null,
    ata: null,
    etd: "2026-03-07T17:00:00.000Z",
    atd: null,
    status: null,
    workStartAt: null,
    workEndAt: null,
    importCutoffAt: null,
    rawLabelMap: {
      _watchIndex: "1",
      _rowColor: "yellow",
    },
    signature: "SWSI-0002:1",
    seenAt: "2026-03-07T00:00:00.000Z",
  };
}

function makeAlertRow(id: string, occurredAt: string): StubAlertRow {
  return {
    id,
    category: "YT",
    type: "yt_count_low",
    dedupeKey: `yt:${id}`,
    title: "YT 로그인 수 하락",
    message: "YT 로그인 수가 임계치 아래입니다.",
    beforeValue: "24",
    afterValue: "23",
    payload: { ytCount: 23 },
    occurredAt: new Date(occurredAt),
  };
}

function createRepoStub(state: StubState) {
  const counters = {
    clearCalls: 0,
    createAlertEventCalls: 0,
  };

  const repo = {
    async getRecentAlerts(limit = 100) {
      return state.alerts.slice(0, limit);
    },
    async clearEventHistory() {
      const deletedCount = state.alerts.length;
      state.alerts = [];
      counters.clearCalls += 1;
      return {
        alertEvents: deletedCount,
        vesselScheduleChangeEvents: 0,
        equipmentLoginEvents: 0,
        weatherAlertEvents: 0,
        notificationLogs: 0,
      };
    },
    async createAlertEvent() {
      counters.createAlertEventCalls += 1;
      throw new Error("createAlertEvent should not be called from DELETE /api/events");
    },
  };

  return {
    repo,
    counters,
  };
}

const createdApps: Array<Awaited<ReturnType<typeof Fastify>>> = [];

afterEach(async () => {
  while (createdApps.length) {
    const app = createdApps.pop();
    if (app) {
      await app.close();
    }
  }
  await clearVesselEtaAdjustmentRecordsForTest();
});

describe("events history clear api", () => {
  it("history populated -> clear -> empty and refresh stays empty", async () => {
    const state: StubState = {
      alerts: [
        makeAlertRow("evt_1", "2026-03-04T01:00:00.000Z"),
        makeAlertRow("evt_2", "2026-03-04T01:01:00.000Z"),
      ],
      baselineFingerprint: "yt:23:low",
    };
    const { repo, counters } = createRepoStub(state);
    const broadcasts: Array<{ eventName: string; payload: unknown }> = [];

    const app = Fastify();
    createdApps.push(app);

    const { registerRoutes } = await import("../src/routes/api.js");
    await registerRoutes(app, {
      repo: repo as any,
      monitorService: {} as any,
      sseHub: {
        broadcast(eventName: string, payload: unknown) {
          broadcasts.push({ eventName, payload });
        },
      } as any,
      cleanupService: {
        async runCleanupOnce() {
          return {};
        },
      } as any,
    });

    const before = await app.inject({ method: "GET", url: "/api/events?limit=200" });
    expect(before.statusCode).toBe(200);
    expect(before.json()).toMatchObject({ count: 2 });

    const clear = await app.inject({ method: "DELETE", url: "/api/events" });
    expect(clear.statusCode).toBe(200);
    expect(clear.json()).toMatchObject({
      ok: true,
      deleted: {
        alertEvents: 2,
      },
    });

    const after = await app.inject({ method: "GET", url: "/api/events?limit=200" });
    expect(after.statusCode).toBe(200);
    expect(after.json()).toMatchObject({ count: 0, items: [] });

    const afterRefresh = await app.inject({ method: "GET", url: "/api/events?limit=200" });
    expect(afterRefresh.statusCode).toBe(200);
    expect(afterRefresh.json()).toMatchObject({ count: 0, items: [] });

    expect(counters.clearCalls).toBe(1);
    expect(counters.createAlertEventCalls).toBe(0);
    expect(broadcasts).toHaveLength(1);
    expect(broadcasts[0]?.eventName).toBe("events_cleared");
    expect((broadcasts[0]?.payload as { deleted?: { alertEvents?: number } })?.deleted?.alertEvents).toBe(2);
  });

  it("clearing events does not reset monitor baseline guard state", async () => {
    const state: StubState = {
      alerts: [makeAlertRow("evt_3", "2026-03-04T02:00:00.000Z")],
      baselineFingerprint: "ys:SUSPENDED:13:30",
    };
    const baselineBefore = state.baselineFingerprint;
    const { repo } = createRepoStub(state);
    let monitorRunCalls = 0;

    const app = Fastify();
    createdApps.push(app);

    const { registerRoutes } = await import("../src/routes/api.js");
    await registerRoutes(app, {
      repo: repo as any,
      monitorService: {
        async runAllOnce() {
          monitorRunCalls += 1;
        },
        async runSourceOnce() {
          monitorRunCalls += 1;
        },
      } as any,
      sseHub: {
        broadcast() {
          // no-op
        },
      } as any,
      cleanupService: {
        async runCleanupOnce() {
          return {};
        },
      } as any,
    });

    const clear = await app.inject({ method: "DELETE", url: "/api/events" });
    expect(clear.statusCode).toBe(200);
    expect(state.baselineFingerprint).toBe(baselineBefore);
    expect(monitorRunCalls).toBe(0);

    const eventsAfter = await app.inject({ method: "GET", url: "/api/events?limit=200" });
    expect(eventsAfter.json()).toMatchObject({ count: 0, items: [] });
  });

  it("clearing events does not remove persisted vessel eta adjustment state", async () => {
    const state: StubState = {
      alerts: [],
      baselineFingerprint: "gwct:eta:SWSI-0002:2026-03-07T16:00",
    };
    const { repo } = createRepoStub(state);

    await saveVesselEtaAdjustmentRecord({
      vesselKey: "SWSI-0002",
      vesselName: "SAWASDEE SIRIUS",
      voyage: "SWSI-0002",
      occurredAt: "2026-03-07T00:05:00.000Z",
      previousEta: "2026-03-07T14:00",
      currentEta: "2026-03-07T16:00",
      deltaMinutes: 120,
      direction: "later",
      crossedDate: false,
      humanMessage: "종전보다 2시간 0분 더 늦게 입항 예정입니다. 2번째 ETA 조정",
      adjustmentCount: 2,
    });

    const app = Fastify();
    createdApps.push(app);

    const { registerRoutes } = await import("../src/routes/api.js");
    await registerRoutes(app, {
      repo: {
        ...repo,
        async getLatestVesselItems() {
          return [makeVesselRow()];
        },
      } as any,
      monitorService: {} as any,
      sseHub: {
        broadcast() {
          // no-op
        },
      } as any,
      cleanupService: {
        async runCleanupOnce() {
          return {};
        },
      } as any,
    });

    const before = await app.inject({ method: "GET", url: "/api/vessels/live" });
    expect(before.statusCode).toBe(200);
    expect(before.json()).toMatchObject({
      items: [
        {
          vesselKey: "SWSI-0002",
          latestEtaChange: {
            humanMessage: "종전보다 2시간 0분 더 늦게 입항 예정입니다. 2번째 ETA 조정",
            adjustmentCount: 2,
          },
        },
      ],
    });

    const clear = await app.inject({ method: "DELETE", url: "/api/events" });
    expect(clear.statusCode).toBe(200);

    const after = await app.inject({ method: "GET", url: "/api/vessels/live" });
    expect(after.statusCode).toBe(200);
    expect(after.json()).toMatchObject({
      items: [
        {
          vesselKey: "SWSI-0002",
          latestEtaChange: {
            humanMessage: "종전보다 2시간 0분 더 늦게 입항 예정입니다. 2번째 ETA 조정",
            adjustmentCount: 2,
          },
        },
      ],
    });
  });
});



