import type { EventCategory, SourceId } from "@gwct/shared";
import type {
  CraneStatus,
  DeviceRegistration,
  EquipmentLoginStatus,
  VesselScheduleItem,
  WeatherNoticeSnapshot,
  YTCountSnapshot,
} from "@gwct/shared";
import { Prisma } from "@prisma/client";
import { prisma } from "./client.js";

export interface AlertEventInput {
  category: EventCategory;
  type: string;
  source: SourceId;
  dedupeKey: string;
  title: string;
  message: string;
  beforeValue: string | null;
  afterValue: string | null;
  payload: Record<string, unknown>;
  occurredAt: string;
}

export interface EventHistoryClearResult {
  alertEvents: number;
  vesselScheduleChangeEvents: number;
  equipmentLoginEvents: number;
  weatherAlertEvents: number;
  notificationLogs: number;
}

export class Repository {
  async startScrapeRun(source: SourceId, url: string, mode: "live" | "fixture") {
    return prisma.scrapeRun.create({
      data: {
        source,
        url,
        mode,
      },
    });
  }

  async finishScrapeRun(
    runId: string,
    result: {
      success: boolean;
      statusCode?: number | null;
      durationMs?: number | null;
      htmlHash?: string | null;
      errorMessage?: string | null;
    },
  ) {
    return prisma.scrapeRun.update({
      where: { id: runId },
      data: {
        finishedAt: new Date(),
        success: result.success,
        statusCode: result.statusCode ?? null,
        durationMs: result.durationMs ?? null,
        htmlHash: result.htmlHash ?? null,
        errorMessage: result.errorMessage ?? null,
      },
    });
  }

  async saveRawSnapshot(input: {
    source: SourceId;
    url: string;
    html: string;
    htmlHash: string;
    textContent?: string;
    metadata?: Record<string, unknown>;
    runId?: string;
  }) {
    return prisma.rawSnapshot.create({
      data: {
        source: input.source,
        url: input.url,
        html: input.html,
        htmlHash: input.htmlHash,
        textContent: input.textContent,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
        runId: input.runId,
      },
    });
  }

  async saveParseError(input: {
    source: SourceId;
    parserName: string;
    reason: string;
    diagnostics: Record<string, unknown>;
    htmlHash?: string;
    runId?: string;
  }) {
    const data = {
      source: input.source,
      parserName: input.parserName,
      reason: input.reason,
      diagnostics: input.diagnostics as Prisma.InputJsonValue,
      htmlHash: input.htmlHash,
      runId: input.runId,
    };

    try {
      return await prisma.parseError.create({ data });
    } catch (error) {
      if (
        input.runId &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2003"
      ) {
        // The scrape run row may be deleted by a concurrent fixture reset; keep parse error without run linkage.
        return prisma.parseError.create({
          data: {
            ...data,
            runId: undefined,
          },
        });
      }
      throw error;
    }
  }

  async saveVesselItems(items: VesselScheduleItem[]) {
    if (!items.length) {
      return;
    }
    await prisma.vesselScheduleItem.createMany({
      data: items.map((item) => ({
        source: item.source,
        vesselKey: item.vesselKey,
        vesselName: item.vesselName,
        terminalVoyage: item.terminalVoyage,
        berth: item.berth,
        shippingLine: item.shippingLine,
        route: item.route,
        eta: item.eta ? new Date(item.eta) : null,
        etb: item.etb ? new Date(item.etb) : null,
        ata: item.ata ? new Date(item.ata) : null,
        etd: item.etd ? new Date(item.etd) : null,
        atd: item.atd ? new Date(item.atd) : null,
        status: item.status,
        workStartAt: item.workStartAt ? new Date(item.workStartAt) : null,
        workEndAt: item.workEndAt ? new Date(item.workEndAt) : null,
        importCutoffAt: item.importCutoffAt ? new Date(item.importCutoffAt) : null,
        rawLabelMap: item.rawLabelMap,
        signature: item.signature,
        seenAt: new Date(item.seenAt),
      })),
    });
  }

  async getLatestVesselItems(source: SourceId): Promise<VesselScheduleItem[]> {
    const latest = await prisma.vesselScheduleItem.findFirst({
      where: { source },
      orderBy: { seenAt: "desc" },
      select: { seenAt: true },
    });

    if (!latest) {
      return [];
    }

    const rows = await prisma.vesselScheduleItem.findMany({
      where: { source, seenAt: latest.seenAt },
    });

    return rows.map((row) => ({
      source: row.source as SourceId,
      vesselKey: row.vesselKey,
      vesselName: row.vesselName,
      terminalVoyage: row.terminalVoyage,
      berth: row.berth,
      shippingLine: row.shippingLine,
      route: row.route,
      eta: row.eta?.toISOString() || null,
      etb: row.etb?.toISOString() || null,
      ata: row.ata?.toISOString() || null,
      etd: row.etd?.toISOString() || null,
      atd: row.atd?.toISOString() || null,
      status: row.status,
      workStartAt: row.workStartAt?.toISOString() || null,
      workEndAt: row.workEndAt?.toISOString() || null,
      importCutoffAt: row.importCutoffAt?.toISOString() || null,
      rawLabelMap: (row.rawLabelMap as Record<string, string>) || {},
      signature: row.signature,
      seenAt: row.seenAt.toISOString(),
    }));
  }

  async saveCraneStatuses(items: CraneStatus[]) {
    if (!items.length) {
      return;
    }
    await prisma.craneStatus.createMany({
      data: items.map((item) => ({
        source: item.source,
        craneId: item.craneId,
        vesselName: item.vesselName,
        dischargeDone: item.dischargeDone,
        loadDone: item.loadDone,
        dischargeRemaining: item.dischargeRemaining,
        loadRemaining: item.loadRemaining,
        totalRemaining: item.totalRemaining,
        progressPercent: item.progressPercent,
        signature: item.signature,
        seenAt: new Date(item.seenAt),
      })),
    });
  }

  async getLatestCraneStatuses(source: SourceId): Promise<CraneStatus[]> {
    const latest = await prisma.craneStatus.findFirst({
      where: { source },
      orderBy: { seenAt: "desc" },
      select: { seenAt: true },
    });

    if (!latest) {
      return [];
    }

    const rows = await prisma.craneStatus.findMany({ where: { source, seenAt: latest.seenAt } });

    return rows.map((row) => ({
      source: row.source as SourceId,
      craneId: row.craneId,
      vesselName: row.vesselName,
      dischargeDone: row.dischargeDone,
      loadDone: row.loadDone,
      dischargeRemaining: row.dischargeRemaining,
      loadRemaining: row.loadRemaining,
      totalRemaining: row.totalRemaining,
      progressPercent: row.progressPercent,
      signature: row.signature,
      seenAt: row.seenAt.toISOString(),
    }));
  }

  async saveEquipmentStatuses(items: EquipmentLoginStatus[]) {
    if (!items.length) {
      return;
    }
    await prisma.equipmentLoginStatus.createMany({
      data: items.map((item) => ({
        source: item.source,
        equipmentId: item.equipmentId,
        operatorName: item.operatorName,
        helperName: item.helperName,
        loginText: item.loginText,
        stopReason: item.stopReason,
        signature: item.signature,
        seenAt: new Date(item.seenAt),
      })),
    });
  }

  async getLatestEquipmentStatuses(source: SourceId): Promise<EquipmentLoginStatus[]> {
    const latest = await prisma.equipmentLoginStatus.findFirst({
      where: { source },
      orderBy: { seenAt: "desc" },
      select: { seenAt: true },
    });

    if (!latest) {
      return [];
    }

    const rows = await prisma.equipmentLoginStatus.findMany({ where: { source, seenAt: latest.seenAt } });

    return rows.map((row) => ({
      source: row.source as SourceId,
      equipmentId: row.equipmentId,
      operatorName: row.operatorName,
      helperName: row.helperName,
      loginText: row.loginText,
      stopReason: row.stopReason,
      signature: row.signature,
      seenAt: row.seenAt.toISOString(),
    }));
  }

  async saveYtSnapshot(snapshot: YTCountSnapshot | null) {
    if (!snapshot) {
      return;
    }

    await prisma.yTCountSnapshot.create({
      data: {
        source: snapshot.source,
        totalLoggedIn: snapshot.totalLoggedIn,
        totalKnown: snapshot.totalKnown,
        threshold: snapshot.threshold,
        signature: snapshot.signature,
        seenAt: new Date(snapshot.seenAt),
      },
    });
  }

  async getLatestYtSnapshot(source: SourceId): Promise<YTCountSnapshot | null> {
    const row = await prisma.yTCountSnapshot.findFirst({
      where: { source },
      orderBy: { seenAt: "desc" },
    });

    if (!row) {
      return null;
    }

    return {
      source: row.source as SourceId,
      totalLoggedIn: row.totalLoggedIn,
      totalKnown: row.totalKnown,
      threshold: row.threshold,
      signature: row.signature,
      seenAt: row.seenAt.toISOString(),
    };
  }

  async saveWeatherSnapshot(snapshot: WeatherNoticeSnapshot | null) {
    if (!snapshot) {
      return;
    }

    await prisma.weatherNoticeSnapshot.create({
      data: {
        source: snapshot.source,
        dutyText: snapshot.standbyCallText ?? snapshot.dutyText,
        dispatchTeamDutyText: snapshot.dispatchTeamDutyText,
        noticeHeadline: snapshot.noticeHeadline,
        suspensionState: snapshot.suspensionState,
        matchedKeywords: snapshot.matchedKeywords,
        severity: snapshot.severity,
        signature: snapshot.signature,
        seenAt: new Date(snapshot.seenAt),
      },
    });
  }

  async getLatestWeatherSnapshot(source: SourceId): Promise<WeatherNoticeSnapshot | null> {
    const row = await prisma.weatherNoticeSnapshot.findFirst({
      where: { source },
      orderBy: { seenAt: "desc" },
    });

    if (!row) {
      return null;
    }

    return {
      source: row.source as SourceId,
      dutyText: row.dutyText,
      dispatchTeamDutyText: row.dispatchTeamDutyText,
      standbyCallText: row.dutyText,
      noticeHeadline: row.noticeHeadline,
      suspensionState: row.suspensionState as "none" | "partial" | "all",
      semanticState: row.suspensionState === "none" ? "NORMAL" : "SUSPENDED",
      matchedKeywords: (row.matchedKeywords as string[]) || [],
      normalizedReason: null,
      severity: row.severity as "normal" | "warning" | "critical",
      signature: row.signature,
      seenAt: row.seenAt.toISOString(),
    };
  }

  async getCraneThresholdMap(): Promise<Map<string, number>> {
    const rows = await prisma.craneThresholdRule.findMany({ where: { enabled: true } });
    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(row.craneId, row.threshold);
    }
    return map;
  }

  async upsertCraneThreshold(craneId: string, threshold: number, enabled = true) {
    return prisma.craneThresholdRule.upsert({
      where: { craneId },
      update: { threshold, enabled },
      create: { craneId, threshold, enabled },
    });
  }

  async getYtThreshold(): Promise<number> {
    const rule = await prisma.yTThresholdRule.findFirst({ orderBy: { updatedAt: "desc" } });
    return rule?.threshold ?? 10;
  }

  async upsertYtThreshold(threshold: number, enabled = true) {
    const existing = await prisma.yTThresholdRule.findFirst();
    if (existing) {
      return prisma.yTThresholdRule.update({
        where: { id: existing.id },
        data: { threshold, enabled },
      });
    }
    return prisma.yTThresholdRule.create({ data: { threshold, enabled } });
  }

  async findRecentAlertByDedupe(dedupeKey: string) {
    return prisma.alertEvent.findFirst({
      where: { dedupeKey },
      orderBy: { lastSeenAt: "desc" },
    });
  }

  async createAlertEvent(input: AlertEventInput) {
    return prisma.alertEvent.create({
      data: {
        category: input.category,
        type: input.type,
        source: input.source,
        dedupeKey: input.dedupeKey,
        title: input.title,
        message: input.message,
        beforeValue: input.beforeValue,
        afterValue: input.afterValue,
        payload: input.payload as Prisma.InputJsonValue,
        occurredAt: new Date(input.occurredAt),
        firstSeenAt: new Date(input.occurredAt),
        lastSeenAt: new Date(input.occurredAt),
      },
    });
  }

  async saveVesselChangeEvents(events: AlertEventInput[]) {
    const rows = events.filter((event) => event.category === "VESSEL");
    if (!rows.length) {
      return;
    }
    await prisma.vesselScheduleChangeEvent.createMany({
      data: rows.map((event) => ({
        source: event.source,
        vesselKey: String(event.payload.vesselKey || ""),
        changeType: event.type,
        fieldName: typeof event.payload.field === "string" ? event.payload.field : null,
        oldValue: event.beforeValue,
        newValue: event.afterValue,
        dedupeKey: event.dedupeKey,
        firstSeenAt: new Date(event.occurredAt),
        lastSeenAt: new Date(event.occurredAt),
        occurredAt: new Date(event.occurredAt),
        metadata: event.payload as Prisma.InputJsonValue,
      })),
    });
  }

  async saveEquipmentLoginEvents(events: AlertEventInput[]) {
    const rows = events.filter((event) => event.category === "EQUIPMENT");
    if (!rows.length) {
      return;
    }
    await prisma.equipmentLoginEvent.createMany({
      data: rows.map((event) => ({
        source: event.source,
        equipmentId: String(event.payload.equipmentId || ""),
        eventType: event.type,
        oldOperator:
          typeof event.payload.oldOperator === "string"
            ? event.payload.oldOperator
            : event.beforeValue,
        newOperator:
          typeof event.payload.newOperator === "string"
            ? event.payload.newOperator
            : event.afterValue,
        oldHelper: typeof event.payload.oldHelper === "string" ? event.payload.oldHelper : null,
        newHelper: typeof event.payload.newHelper === "string" ? event.payload.newHelper : null,
        dedupeKey: event.dedupeKey,
        firstSeenAt: new Date(event.occurredAt),
        lastSeenAt: new Date(event.occurredAt),
        occurredAt: new Date(event.occurredAt),
      })),
    });
  }

  async saveWeatherAlertEvents(events: AlertEventInput[]) {
    const rows = events.filter((event) => event.category === "WEATHER");
    if (!rows.length) {
      return;
    }
    await prisma.weatherAlertEvent.createMany({
      data: rows.map((event) => ({
        source: event.source,
        alertKind: event.type,
        oldState: String(event.payload.oldState || "none"),
        newState: String(event.payload.newState || "none"),
        oldText: event.beforeValue,
        newText: event.afterValue,
        dedupeKey: event.dedupeKey,
        firstSeenAt: new Date(event.occurredAt),
        lastSeenAt: new Date(event.occurredAt),
        occurredAt: new Date(event.occurredAt),
      })),
    });
  }

  async touchAlertEvent(id: string, seenAt: string) {
    return prisma.alertEvent.update({
      where: { id },
      data: { lastSeenAt: new Date(seenAt) },
    });
  }

  async getRecentAlerts(limit = 100) {
    return prisma.alertEvent.findMany({
      orderBy: { occurredAt: "desc" },
      take: limit,
    });
  }

  async clearEventHistory(): Promise<EventHistoryClearResult> {
    const [
      alertEvents,
      vesselScheduleChangeEvents,
      equipmentLoginEvents,
      weatherAlertEvents,
      notificationLogs,
    ] = await prisma.$transaction([
      prisma.alertEvent.deleteMany({}),
      prisma.vesselScheduleChangeEvent.deleteMany({}),
      prisma.equipmentLoginEvent.deleteMany({}),
      prisma.weatherAlertEvent.deleteMany({}),
      prisma.notificationLog.deleteMany({}),
    ]);

    return {
      alertEvents: alertEvents.count,
      vesselScheduleChangeEvents: vesselScheduleChangeEvents.count,
      equipmentLoginEvents: equipmentLoginEvents.count,
      weatherAlertEvents: weatherAlertEvents.count,
      notificationLogs: notificationLogs.count,
    };
  }

  async registerDevice(input: DeviceRegistration) {
    return prisma.deviceRegistration.upsert({
      where: { deviceId: input.deviceId },
      update: {
        platform: input.platform,
        expoPushToken: input.expoPushToken,
        timezone: input.timezone,
        appVersion: input.appVersion,
        alertsEnabled: input.alertsEnabled,
      },
      create: {
        deviceId: input.deviceId,
        platform: input.platform,
        expoPushToken: input.expoPushToken,
        timezone: input.timezone,
        appVersion: input.appVersion,
        alertsEnabled: input.alertsEnabled,
        categoryPrefs: {
          VESSEL: true,
          CRANE: true,
          EQUIPMENT: true,
          YT: true,
          WEATHER: true,
        },
      },
    });
  }

  async updateDeviceSettings(
    deviceId: string,
    settings: {
      alertsEnabled?: boolean;
      quietHoursFrom?: string | null;
      quietHoursTo?: string | null;
      categoryPrefs?: Record<string, boolean>;
    },
  ) {
    return prisma.deviceRegistration.update({
      where: { deviceId },
      data: {
        alertsEnabled: settings.alertsEnabled,
        quietHoursFrom: settings.quietHoursFrom,
        quietHoursTo: settings.quietHoursTo,
        categoryPrefs: settings.categoryPrefs,
      },
    });
  }

  async listDevicesForCategory(category: EventCategory) {
    const rows = await prisma.deviceRegistration.findMany({
      where: {
        alertsEnabled: true,
        NOT: { expoPushToken: null },
      },
    });

    return rows.filter((row) => {
      const prefs = (row.categoryPrefs as Record<string, boolean>) || {};
      return prefs[category] !== false;
    });
  }

  async logNotification(input: {
    eventId: string;
    category: EventCategory;
    title: string;
    body: string;
    provider: string;
    success: boolean;
    error?: string | null;
    payload: Record<string, unknown>;
    recipientCount: number;
  }) {
    return prisma.notificationLog.create({
      data: {
        eventId: input.eventId,
        category: input.category,
        title: input.title,
        body: input.body,
        provider: input.provider,
        success: input.success,
        error: input.error,
        payload: input.payload as Prisma.InputJsonValue,
        recipientCount: input.recipientCount,
      },
    });
  }

  async getLatestRawSnapshots(limit = 20) {
    return prisma.rawSnapshot.findMany({
      orderBy: { fetchedAt: "desc" },
      take: limit,
      select: {
        id: true,
        source: true,
        url: true,
        htmlHash: true,
        fetchedAt: true,
      },
    });
  }

  async getRecentParseErrors(limit = 50) {
    return prisma.parseError.findMany({
      orderBy: { happenedAt: "desc" },
      take: limit,
    });
  }

  async getDashboardSummary() {
    const [latestAlert, vessel, crane, equip, yt, weather, alertCount] = await Promise.all([
      prisma.alertEvent.findFirst({ orderBy: { occurredAt: "desc" }, select: { occurredAt: true } }),
      prisma.vesselScheduleItem.count({}),
      prisma.craneStatus.count({}),
      prisma.equipmentLoginStatus.count({ where: { operatorName: { not: null } } }),
      prisma.yTCountSnapshot.findFirst({ orderBy: { seenAt: "desc" } }),
      prisma.weatherNoticeSnapshot.findFirst({ orderBy: { seenAt: "desc" } }),
      prisma.alertEvent.count({ where: { occurredAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
    ]);

    return {
      lastUpdatedAt: latestAlert?.occurredAt.toISOString() ?? null,
      vesselCount: vessel,
      craneCount: crane,
      equipmentActiveCount: equip,
      ytLoggedInCount: yt?.totalLoggedIn ?? 0,
      weatherState: (weather?.suspensionState as "none" | "partial" | "all") ?? "none",
      alertCount24h: alertCount,
    };
  }

  async getDashboardMeta() {
    const [latestAlert, alertCount] = await Promise.all([
      prisma.alertEvent.findFirst({ orderBy: { occurredAt: "desc" }, select: { occurredAt: true } }),
      prisma.alertEvent.count({ where: { occurredAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
    ]);

    return {
      lastUpdatedAt: latestAlert?.occurredAt.toISOString() ?? null,
      alertCount24h: alertCount,
    };
  }
}
