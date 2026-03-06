import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  DeviceRegistrationSchema,
  type AlertEvent,
  type SourceId,
} from "@gwct/shared";
import { z } from "zod";
import { uid } from "../lib/id.js";
import type { Repository } from "../db/repository.js";
import type { MonitorService } from "../services/monitorService.js";
import type { SseHub } from "../lib/sse.js";
import type { DataRetentionService } from "../services/cleanup/service.js";
import { env } from "../config/env.js";
import { SOURCE_DEFINITIONS } from "../scraper/sources.js";
import { loadGcLatestSnapshot } from "../services/gc/latestStore.js";
import {
  countSupportEquipmentLogins,
  countTrackedVessels,
  countWorkingGcCranes,
} from "../services/dashboard/summary.js";
import { loadEquipmentLatestSnapshot } from "../services/equipment/latestStore.js";
import { buildGcCraneLiveRows } from "../services/gc/workState.js";
import { loadScheduleFocusSnapshot } from "../services/scheduleFocus/latestStore.js";
import { loadMonitorSettings, saveMonitorSettings, type MonitorSettingsInput } from "../services/monitorConfig/store.js";

interface RouteDeps {
  repo: Repository;
  monitorService: MonitorService;
  sseHub: SseHub;
  cleanupService: DataRetentionService;
}

function requireDebugToken(request: FastifyRequest, reply: FastifyReply): boolean {
  const token = request.headers["x-debug-token"];
  if (token !== env.DEBUG_TOKEN) {
    reply.code(401).send({ error: "Unauthorized" });
    return false;
  }
  return true;
}

const GcThresholdOverrideSchema = z.object({
  dischargeThreshold: z.number().int().nonnegative().optional(),
  loadThreshold: z.number().int().nonnegative().optional(),
});

const GcThresholdInputSchema = z.object({
  dischargeThreshold: z.number().int().nonnegative().optional(),
  loadThreshold: z.number().int().nonnegative().optional(),
  overrides: z.record(z.string(), GcThresholdOverrideSchema).optional(),
});

const EquipmentConfigInputSchema = z.object({
  ytThresholdLow: z.number().int().nonnegative().optional(),
  ytThresholdRecover: z.number().int().nonnegative().optional(),
});

const GwctEtaMonitorInputSchema = z.object({
  enabled: z.boolean().optional(),
  trackingCount: z.number().int().min(1).max(11).optional(),
});

const GcRemainingMonitorRuleInputSchema = z.object({
  enabled: z.boolean().optional(),
  threshold: z.number().int().nonnegative().optional(),
});

const EquipmentMonitorInputSchema = z.object({
  yt: z
    .object({
      enabled: z.boolean().optional(),
      threshold: z.number().int().nonnegative().optional(),
    })
    .optional(),
  gcStaff: z
    .object({
      enabled: z.boolean().optional(),
    })
    .optional(),
});

const YeosuPilotageMonitorInputSchema = z.object({
  enabled: z.boolean().optional(),
});

const MonitorConfigInputSchema = z.object({
  gwctEtaMonitor: GwctEtaMonitorInputSchema.optional(),
  gcRemainingMonitors: z.record(z.string(), GcRemainingMonitorRuleInputSchema).optional(),
  equipmentMonitor: EquipmentMonitorInputSchema.optional(),
  yeosuPilotageMonitor: YeosuPilotageMonitorInputSchema.optional(),
});

const CleanupRunInputSchema = z.object({
  fullVacuum: z.boolean().optional(),
});

function toLegacyGcThresholdPayload(settings: Awaited<ReturnType<typeof loadMonitorSettings>>) {
  const defaultThreshold = 20;
  const overrides: Record<string, { dischargeThreshold: number; loadThreshold: number }> = {};
  for (let gc = 181; gc <= 190; gc += 1) {
    const rule = settings.gcRemainingMonitors[String(gc)];
    if (!rule) {
      continue;
    }
    overrides[String(gc)] = {
      dischargeThreshold: rule.threshold,
      loadThreshold: rule.threshold,
    };
  }
  return {
    dischargeThreshold: defaultThreshold,
    loadThreshold: defaultThreshold,
    overrides,
    monitors: settings.gcRemainingMonitors,
  };
}

function toLegacyEquipmentConfigPayload(settings: Awaited<ReturnType<typeof loadMonitorSettings>>) {
  return {
    ytThresholdLow: settings.equipmentMonitor.yt.threshold,
    ytThresholdRecover: settings.equipmentMonitor.yt.threshold,
    ytStateInitialized: settings.equipmentMonitor.yt.stateInitialized,
    ytState: settings.equipmentMonitor.yt.state,
    ytEnabled: settings.equipmentMonitor.yt.enabled,
    gcStaffEnabled: settings.equipmentMonitor.gcStaff.enabled,
  };
}

export async function registerRoutes(app: FastifyInstance, deps: RouteDeps) {
  const buildAlertsResponse = async (rawLimit?: string) => {
    const limit = rawLimit ? Number(rawLimit) : 100;
    const rows = await deps.repo.getRecentAlerts(Number.isFinite(limit) ? limit : 100);
    const alerts: AlertEvent[] = rows.map((row) => ({
      id: row.id,
      category: row.category as AlertEvent["category"],
      type: row.type,
      dedupeKey: row.dedupeKey,
      title: row.title,
      message: row.message,
      beforeValue: row.beforeValue,
      afterValue: row.afterValue,
      payload: (row.payload as Record<string, unknown>) || {},
      occurredAt: row.occurredAt.toISOString(),
    }));
    return {
      count: alerts.length,
      items: alerts,
    };
  };

  app.get("/health", async () => ({ ok: true, time: new Date().toISOString() }));

  app.get("/api/dashboard/summary", async () => {
    const [settings, scheduleLatest, gcLatest, equipmentLatest, equipmentRows, ytSnapshot, weather, meta] = await Promise.all([
      loadMonitorSettings(),
      loadScheduleFocusSnapshot(),
      loadGcLatestSnapshot(),
      loadEquipmentLatestSnapshot(),
      deps.repo.getLatestEquipmentStatuses("gwct_equipment_status"),
      deps.repo.getLatestYtSnapshot("gwct_equipment_status"),
      deps.repo.getLatestWeatherSnapshot("ys_forecast"),
      deps.repo.getDashboardMeta(),
    ]);

    return {
      lastUpdatedAt: meta.lastUpdatedAt,
      trackedVesselCount: countTrackedVessels(settings.gwctEtaMonitor.trackingCount, scheduleLatest),
      workingCraneCount: countWorkingGcCranes(gcLatest, equipmentLatest),
      supportEquipmentLoginCount: countSupportEquipmentLogins(equipmentRows),
      ytLoggedInCount: ytSnapshot?.totalLoggedIn ?? 0,
      weatherState: weather?.suspensionState ?? "none",
      alertCount24h: meta.alertCount24h,
    };
  });

  app.get("/api/vessels/live", async () => {
    const [rows, alerts] = await Promise.all([
      deps.repo.getLatestVesselItems("gwct_schedule_list"),
      deps.repo.getRecentAlerts(500),
    ]);

    const latestEtaChangeByVessel = new Map<
      string,
      {
        eventId: string;
        occurredAt: string;
        previousEta: string;
        currentEta: string;
        deltaMinutes: number;
        direction: "earlier" | "later";
        crossedDate: boolean;
        humanMessage: string;
      }
    >();

    for (const alert of alerts) {
      if (alert.type !== "gwct_eta_changed") {
        continue;
      }
      const payload = (alert.payload || {}) as Record<string, unknown>;
      const vesselKey = typeof payload.vesselKey === "string" ? payload.vesselKey : null;
      if (!vesselKey || latestEtaChangeByVessel.has(vesselKey)) {
        continue;
      }

      const previousEta = typeof payload.previousEta === "string" ? payload.previousEta : null;
      const currentEta = typeof payload.currentEta === "string" ? payload.currentEta : null;
      const deltaMinutes = typeof payload.deltaMinutes === "number" ? payload.deltaMinutes : null;
      const direction =
        payload.direction === "earlier" || payload.direction === "later" ? payload.direction : null;
      const crossedDate = typeof payload.crossedDate === "boolean" ? payload.crossedDate : false;
      const humanMessage = typeof payload.humanMessage === "string" ? payload.humanMessage : null;
      if (!previousEta || !currentEta || deltaMinutes === null || !direction || !humanMessage) {
        continue;
      }

      latestEtaChangeByVessel.set(vesselKey, {
        eventId: alert.id,
        occurredAt: alert.occurredAt.toISOString(),
        previousEta,
        currentEta,
        deltaMinutes,
        direction,
        crossedDate,
        humanMessage,
      });
    }

    return {
      source: "gwct_schedule_list",
      count: rows.length,
      items: rows.map((row) => ({
        ...row,
        latestEtaChange: latestEtaChangeByVessel.get(row.vesselKey) || null,
      })),
    };
  });

  app.get("/api/cranes/live", async () => {
    const [gcLatest, equipmentLatest, workStatusRows] = await Promise.all([
      loadGcLatestSnapshot(),
      loadEquipmentLatestSnapshot(),
      deps.repo.getLatestCraneStatuses("gwct_work_status"),
    ]);

    if (!gcLatest && !equipmentLatest && workStatusRows.length === 0) {
      return {
        source: "gwct_gc_remaining",
        count: 0,
        items: [],
      };
    }

    const rows = buildGcCraneLiveRows(gcLatest, equipmentLatest, workStatusRows);
    return {
      source: "gwct_gc_remaining",
      count: rows.length,
      items: rows,
    };
  });

  app.get("/api/equipment/live", async () => {
    const rows = await deps.repo.getLatestEquipmentStatuses("gwct_equipment_status");
    return {
      source: "gwct_equipment_status",
      count: rows.length,
      items: rows,
    };
  });

  app.get("/api/equipment/latest", async (request, reply) => {
    const latest = await loadEquipmentLatestSnapshot();
    if (!latest) {
      return reply.code(404).send({ error: "Equipment latest snapshot not found" });
    }
    return latest;
  });

  app.get("/api/equipment/config", async () => {
    const settings = await loadMonitorSettings();
    return toLegacyEquipmentConfigPayload(settings);
  });

  app.post("/api/equipment/config", async (request, reply) => {
    const parsed = EquipmentConfigInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const current = await loadMonitorSettings();
    const nextLow = parsed.data.ytThresholdLow ?? current.equipmentMonitor.yt.threshold;
    const nextRecover = parsed.data.ytThresholdRecover ?? current.equipmentMonitor.yt.threshold;
    if (nextRecover < nextLow) {
      return reply.code(400).send({
        error: "ytThresholdRecover must be greater than or equal to ytThresholdLow",
      });
    }

    const saved = await saveMonitorSettings({
      equipmentMonitor: {
        yt: {
          threshold: nextLow,
        },
      },
    });

    return toLegacyEquipmentConfigPayload(saved);
  });

  app.get("/api/yt/live", async () => {
    const [snapshot, settings, latest] = await Promise.all([
      deps.repo.getLatestYtSnapshot("gwct_equipment_status"),
      loadMonitorSettings(),
      loadEquipmentLatestSnapshot(),
    ]);
    return {
      source: "gwct_equipment_status",
      snapshot,
      ytCount: latest?.ytCount ?? snapshot?.totalLoggedIn ?? 0,
      ytKnown: latest?.ytKnown ?? snapshot?.totalKnown ?? 0,
      units: latest?.ytUnits || [],
      capturedAt: latest?.capturedAt || snapshot?.seenAt || null,
      threshold: settings.equipmentMonitor.yt.threshold,
      thresholdLow: settings.equipmentMonitor.yt.threshold,
      thresholdRecover: settings.equipmentMonitor.yt.threshold,
      state: settings.equipmentMonitor.yt.state,
      enabled: settings.equipmentMonitor.yt.enabled,
    };
  });

  app.get("/api/weather/live", async () => {
    const forecast = await deps.repo.getLatestWeatherSnapshot("ys_forecast");
    const notice = await deps.repo.getLatestWeatherSnapshot("ys_notice");
    const settings = await loadMonitorSettings();
    return {
      forecast,
      notice,
      primary: forecast,
      monitor: settings.yeosuPilotageMonitor,
    };
  });

  app.get("/api/gc/latest", async (request, reply) => {
    const latest = await loadGcLatestSnapshot();
    if (!latest) {
      return reply.code(404).send({ error: "GC latest snapshot not found" });
    }
    return latest;
  });

  app.get("/api/schedule/focus/latest", async (request, reply) => {
    const latest = await loadScheduleFocusSnapshot();
    if (!latest) {
      return reply.code(404).send({ error: "Schedule focus latest snapshot not found" });
    }
    return latest;
  });

  app.get("/api/monitors/config", async () => {
    return loadMonitorSettings();
  });

  app.post("/api/monitors/config", async (request, reply) => {
    const parsed = MonitorConfigInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const payload = parsed.data as MonitorSettingsInput;
    const saved = await saveMonitorSettings(payload);
    return saved;
  });

  app.get("/api/monitors/gwct-eta", async () => {
    const [config, latest] = await Promise.all([loadMonitorSettings(), loadScheduleFocusSnapshot()]);
    const trackingCount = config.gwctEtaMonitor.trackingCount;
    return {
      ...config.gwctEtaMonitor,
      latestCapturedAt: latest?.capturedAt || null,
      preview: latest?.items.slice(0, trackingCount) || [],
    };
  });

  app.post("/api/monitors/gwct-eta", async (request, reply) => {
    const parsed = GwctEtaMonitorInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const saved = await saveMonitorSettings({
      gwctEtaMonitor: parsed.data,
    });
    return saved.gwctEtaMonitor;
  });

  app.get("/api/monitors/gc-remaining", async () => {
    const [config, latest] = await Promise.all([loadMonitorSettings(), loadGcLatestSnapshot()]);
    return {
      monitors: config.gcRemainingMonitors,
      latestCapturedAt: latest?.capturedAt || null,
      latestItems: latest?.items || [],
    };
  });

  app.post("/api/monitors/gc-remaining", async (request, reply) => {
    const parsed = z
      .object({
        gcRemainingMonitors: z.record(z.string(), GcRemainingMonitorRuleInputSchema),
      })
      .safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const saved = await saveMonitorSettings({
      gcRemainingMonitors: parsed.data.gcRemainingMonitors,
    });
    return saved.gcRemainingMonitors;
  });

  app.get("/api/monitors/equipment", async () => {
    const [config, latest] = await Promise.all([loadMonitorSettings(), loadEquipmentLatestSnapshot()]);
    return {
      ...config.equipmentMonitor,
      latestCapturedAt: latest?.capturedAt || null,
      ytCount: latest?.ytCount || 0,
      ytUnits: latest?.ytUnits || [],
      gcStates: latest?.gcStates || [],
    };
  });

  app.post("/api/monitors/equipment", async (request, reply) => {
    const parsed = EquipmentMonitorInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const saved = await saveMonitorSettings({
      equipmentMonitor: parsed.data,
    });
    return saved.equipmentMonitor;
  });

  app.get("/api/monitors/yeosu", async () => {
    const [config, forecast] = await Promise.all([
      loadMonitorSettings(),
      deps.repo.getLatestWeatherSnapshot("ys_forecast"),
    ]);
    return {
      ...config.yeosuPilotageMonitor,
      latestCapturedAt: forecast?.seenAt || null,
      latestForecastState: forecast?.suspensionState || "none",
      latestDutyText: forecast?.dispatchTeamDutyText || forecast?.standbyCallText || forecast?.dutyText || null,
    };
  });

  app.post("/api/monitors/yeosu", async (request, reply) => {
    const parsed = YeosuPilotageMonitorInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const saved = await saveMonitorSettings({
      yeosuPilotageMonitor: parsed.data,
    });
    return saved.yeosuPilotageMonitor;
  });

  app.get("/api/monitors/status", async () => {
    const [config, scheduleLatest, gcLatest, equipmentLatest, forecast] = await Promise.all([
      loadMonitorSettings(),
      loadScheduleFocusSnapshot(),
      loadGcLatestSnapshot(),
      loadEquipmentLatestSnapshot(),
      deps.repo.getLatestWeatherSnapshot("ys_forecast"),
    ]);

    const previewCount = config.gwctEtaMonitor.trackingCount;
    const schedulePreview = scheduleLatest?.items.slice(0, previewCount) || [];

    return {
      config,
      previews: {
        gwctEta: {
          capturedAt: scheduleLatest?.capturedAt || null,
          count: schedulePreview.length,
          items: schedulePreview,
        },
        gcRemaining: {
          capturedAt: gcLatest?.capturedAt || null,
          items: gcLatest?.items || [],
        },
        equipment: {
          capturedAt: equipmentLatest?.capturedAt || null,
          ytCount: equipmentLatest?.ytCount || 0,
          ytUnits: equipmentLatest?.ytUnits || [],
          gcStates: equipmentLatest?.gcStates || [],
        },
        yeosuPilotage: {
          capturedAt: forecast?.seenAt || null,
          suspensionState: forecast?.suspensionState || "none",
          dutyText: forecast?.dispatchTeamDutyText || forecast?.standbyCallText || forecast?.dutyText || null,
        },
      },
    };
  });

  app.get("/api/gc/thresholds", async () => {
    const settings = await loadMonitorSettings();
    return toLegacyGcThresholdPayload(settings);
  });

  app.post("/api/gc/thresholds", async (request, reply) => {
    const parsed = GcThresholdInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const current = await loadMonitorSettings();
    const patch: MonitorSettingsInput = {
      gcRemainingMonitors: {},
    };

    const baseThreshold =
      parsed.data.dischargeThreshold ??
      parsed.data.loadThreshold ??
      current.gcRemainingMonitors["181"]?.threshold ??
      20;
    for (let gc = 181; gc <= 190; gc += 1) {
      patch.gcRemainingMonitors![String(gc)] = {
        threshold: baseThreshold,
      };
    }

    for (const [gcKey, override] of Object.entries(parsed.data.overrides || {})) {
      const gc = Number(gcKey);
      if (!Number.isInteger(gc) || gc < 181 || gc > 190) {
        continue;
      }
      patch.gcRemainingMonitors![gcKey] = {
        threshold:
          override.dischargeThreshold ??
          override.loadThreshold ??
          patch.gcRemainingMonitors![gcKey]?.threshold ??
          baseThreshold,
      };
    }

    const saved = await saveMonitorSettings(patch);
    return toLegacyGcThresholdPayload(saved);
  });

  app.get("/api/alerts", async (request) => {
    const query = request.query as { limit?: string };
    return buildAlertsResponse(query.limit);
  });

  app.get("/api/events", async (request) => {
    const query = request.query as { limit?: string };
    return buildAlertsResponse(query.limit);
  });

  app.delete("/api/events", async () => {
    const deleted = await deps.repo.clearEventHistory();
    const clearedAt = new Date().toISOString();
    deps.sseHub.broadcast("events_cleared", {
      clearedAt,
      deleted,
    });

    return {
      ok: true,
      clearedAt,
      deleted,
    };
  });

  app.post("/api/devices/register", async (request, reply) => {
    const parsed = DeviceRegistrationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const saved = await deps.repo.registerDevice(parsed.data);
    return {
      id: saved.id,
      deviceId: saved.deviceId,
      platform: saved.platform,
      alertsEnabled: saved.alertsEnabled,
      bannerEnabled: saved.bannerEnabled,
      themeMode: saved.themeMode,
    };
  });

  app.patch("/api/settings/device/:deviceId", async (request, reply) => {
    const params = request.params as { deviceId: string };
    const body = request.body as {
      alertsEnabled?: boolean;
      bannerEnabled?: boolean;
      themeMode?: "system" | "dark" | "light";
      quietHoursFrom?: string | null;
      quietHoursTo?: string | null;
      categoryPrefs?: Record<string, boolean>;
      ytThreshold?: number;
      craneThresholds?: Array<{ craneId: string; threshold: number; enabled?: boolean }>;
    };

    try {
      const result = await deps.repo.updateDeviceSettings(params.deviceId, {
        alertsEnabled: body.alertsEnabled,
        bannerEnabled: body.bannerEnabled,
        themeMode: body.themeMode,
        quietHoursFrom: body.quietHoursFrom,
        quietHoursTo: body.quietHoursTo,
        categoryPrefs: body.categoryPrefs,
      });

      if (typeof body.ytThreshold === "number") {
        await deps.repo.upsertYtThreshold(body.ytThreshold, true);
      }

      if (Array.isArray(body.craneThresholds)) {
        for (const rule of body.craneThresholds) {
          if (!rule.craneId || typeof rule.threshold !== "number") {
            continue;
          }
          await deps.repo.upsertCraneThreshold(rule.craneId, rule.threshold, rule.enabled ?? true);
        }
      }

      return {
        id: result.id,
        deviceId: result.deviceId,
        alertsEnabled: result.alertsEnabled,
        bannerEnabled: result.bannerEnabled,
        themeMode: result.themeMode,
        updatedAt: result.updatedAt,
      };
    } catch (error) {
      return reply.code(400).send({ error: String((error as Error).message) });
    }
  });

  app.get("/api/stream/events", async (request, reply) => {
    reply.hijack();
    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.write(`event: welcome\ndata: ${JSON.stringify({ connectedAt: new Date().toISOString() })}\n\n`);

    const id = uid("sse");
    deps.sseHub.add({ id, response: reply.raw });

    const heartbeat = setInterval(() => {
      reply.raw.write(`event: ping\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);
    }, 15000);

    request.raw.on("close", () => {
      clearInterval(heartbeat);
      deps.sseHub.remove(id);
    });

    return;
  });

  app.post("/api/admin/scrape/once", async (request, reply) => {
    if (!requireDebugToken(request, reply)) {
      return;
    }
    const body = request.body as { source?: SourceId; mode?: "live" | "fixture"; fixtureSet?: string };

    if (body.source) {
      const sourceDef = SOURCE_DEFINITIONS.find((item) => item.source === body.source);
      if (!sourceDef) {
        return reply.code(400).send({ error: "Unknown source" });
      }
      await deps.monitorService.runSourceOnce(sourceDef, {
        mode: body.mode,
        fixtureSet: body.fixtureSet,
      });
      return { ok: true, source: body.source };
    }

    await deps.monitorService.runAllOnce({
      mode: body.mode,
      fixtureSet: body.fixtureSet,
    });

    return { ok: true, all: true };
  });

  app.post("/api/admin/cleanup/run", async (request, reply) => {
    if (!requireDebugToken(request, reply)) {
      return;
    }

    const parsed = CleanupRunInputSchema.safeParse(request.body || {});
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const result = await deps.cleanupService.runCleanupOnce({
      trigger: "manual",
      force: true,
      manualFullVacuum: parsed.data.fullVacuum === true,
    });

    return {
      ok: true,
      result,
    };
  });

  app.get("/api/debug/snapshots/latest", async (request, reply) => {
    if (!requireDebugToken(request, reply)) {
      return;
    }
    return deps.repo.getLatestRawSnapshots(20);
  });

  app.get("/api/debug/parse-errors", async (request, reply) => {
    if (!requireDebugToken(request, reply)) {
      return;
    }
    return deps.repo.getRecentParseErrors(50);
  });
}
