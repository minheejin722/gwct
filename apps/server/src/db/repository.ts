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

export interface TransientRetentionCleanupResult {
  rawSnapshots: number;
  parseErrors: number;
  notificationLogs: number;
  scrapeRuns: number;
  detachedRawSnapshotRunRefs: number;
  detachedParseErrorRunRefs: number;
}

export interface SnapshotHistoryTrimResult {
  vesselScheduleItems: number;
  craneStatuses: number;
  equipmentLoginStatuses: number;
  ytCountSnapshots: number;
  weatherNoticeSnapshots: number;
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
        dutyText: snapshot.dutyText,
        dispatchTeamDutyText: snapshot.dispatchTeamDutyText,
        standbyCallText: snapshot.standbyCallText,
        noticeHeadline: snapshot.noticeHeadline,
        suspensionState: snapshot.suspensionState,
        semanticState: snapshot.semanticState,
        matchedKeywords: snapshot.matchedKeywords,
        normalizedReason: snapshot.normalizedReason,
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
      standbyCallText: row.standbyCallText,
      noticeHeadline: row.noticeHeadline,
      suspensionState: row.suspensionState as "none" | "partial" | "all",
      semanticState: row.semanticState as "NORMAL" | "SUSPENDED" | "UNKNOWN",
      matchedKeywords: (row.matchedKeywords as string[]) || [],
      normalizedReason: row.normalizedReason,
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

  async countGwctEtaAdjustments(vesselKey: string): Promise<number> {
    return prisma.vesselScheduleChangeEvent.count({
      where: {
        changeType: "gwct_eta_changed",
        vesselKey,
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

  async cleanupTransientData(cutoff: Date): Promise<TransientRetentionCleanupResult> {
    const rawSnapshots = await prisma.rawSnapshot.deleteMany({
      where: {
        fetchedAt: {
          lt: cutoff,
        },
      },
    });

    const parseErrors = await prisma.parseError.deleteMany({
      where: {
        happenedAt: {
          lt: cutoff,
        },
      },
    });

    const notificationLogs = await prisma.notificationLog.deleteMany({
      where: {
        sentAt: {
          lt: cutoff,
        },
      },
    });

    const runsToDelete = await prisma.scrapeRun.findMany({
      where: {
        finishedAt: {
          not: null,
          lt: cutoff,
        },
      },
      select: {
        id: true,
      },
    });

    if (!runsToDelete.length) {
      return {
        rawSnapshots: rawSnapshots.count,
        parseErrors: parseErrors.count,
        notificationLogs: notificationLogs.count,
        scrapeRuns: 0,
        detachedRawSnapshotRunRefs: 0,
        detachedParseErrorRunRefs: 0,
      };
    }

    const runIds = runsToDelete.map((row) => row.id);
    const detachedRawSnapshotRunRefs = await prisma.rawSnapshot.updateMany({
      where: {
        runId: {
          in: runIds,
        },
      },
      data: {
        runId: null,
      },
    });
    const detachedParseErrorRunRefs = await prisma.parseError.updateMany({
      where: {
        runId: {
          in: runIds,
        },
      },
      data: {
        runId: null,
      },
    });

    const scrapeRuns = await prisma.scrapeRun.deleteMany({
      where: {
        id: {
          in: runIds,
        },
      },
    });

    return {
      rawSnapshots: rawSnapshots.count,
      parseErrors: parseErrors.count,
      notificationLogs: notificationLogs.count,
      scrapeRuns: scrapeRuns.count,
      detachedRawSnapshotRunRefs: detachedRawSnapshotRunRefs.count,
      detachedParseErrorRunRefs: detachedParseErrorRunRefs.count,
    };
  }

  async trimSnapshotHistory(keepSeenAtGroupsPerSource = 2): Promise<SnapshotHistoryTrimResult> {
    const keepCount = Math.max(1, Math.trunc(keepSeenAtGroupsPerSource));

    const vesselScheduleItems = await this.trimVesselScheduleItemHistory(keepCount);
    const craneStatuses = await this.trimCraneStatusHistory(keepCount);
    const equipmentLoginStatuses = await this.trimEquipmentLoginStatusHistory(keepCount);
    const ytCountSnapshots = await this.trimYtCountSnapshotHistory(keepCount);
    const weatherNoticeSnapshots = await this.trimWeatherNoticeSnapshotHistory(keepCount);

    return {
      vesselScheduleItems,
      craneStatuses,
      equipmentLoginStatuses,
      ytCountSnapshots,
      weatherNoticeSnapshots,
    };
  }

  async runIncrementalVacuum(pageCount: number): Promise<void> {
    const pages = Math.max(1, Math.trunc(pageCount));
    await prisma.$executeRawUnsafe(`PRAGMA incremental_vacuum(${pages})`);
  }

  async runFullVacuum(): Promise<void> {
    await prisma.$executeRawUnsafe("VACUUM");
  }

  private async trimVesselScheduleItemHistory(keepCount: number): Promise<number> {
    const sources = await prisma.vesselScheduleItem.findMany({
      distinct: ["source"],
      select: {
        source: true,
      },
    });

    let deleted = 0;
    for (const sourceRow of sources) {
      const staleSeenAt = await prisma.vesselScheduleItem.findMany({
        where: { source: sourceRow.source },
        distinct: ["seenAt"],
        orderBy: {
          seenAt: "desc",
        },
        skip: keepCount,
        select: {
          seenAt: true,
        },
      });

      if (!staleSeenAt.length) {
        continue;
      }

      const result = await prisma.vesselScheduleItem.deleteMany({
        where: {
          source: sourceRow.source,
          seenAt: {
            in: staleSeenAt.map((row) => row.seenAt),
          },
        },
      });
      deleted += result.count;
    }

    return deleted;
  }

  private async trimCraneStatusHistory(keepCount: number): Promise<number> {
    const sources = await prisma.craneStatus.findMany({
      distinct: ["source"],
      select: {
        source: true,
      },
    });

    let deleted = 0;
    for (const sourceRow of sources) {
      const staleSeenAt = await prisma.craneStatus.findMany({
        where: { source: sourceRow.source },
        distinct: ["seenAt"],
        orderBy: {
          seenAt: "desc",
        },
        skip: keepCount,
        select: {
          seenAt: true,
        },
      });

      if (!staleSeenAt.length) {
        continue;
      }

      const result = await prisma.craneStatus.deleteMany({
        where: {
          source: sourceRow.source,
          seenAt: {
            in: staleSeenAt.map((row) => row.seenAt),
          },
        },
      });
      deleted += result.count;
    }

    return deleted;
  }

  private async trimEquipmentLoginStatusHistory(keepCount: number): Promise<number> {
    const sources = await prisma.equipmentLoginStatus.findMany({
      distinct: ["source"],
      select: {
        source: true,
      },
    });

    let deleted = 0;
    for (const sourceRow of sources) {
      const staleSeenAt = await prisma.equipmentLoginStatus.findMany({
        where: { source: sourceRow.source },
        distinct: ["seenAt"],
        orderBy: {
          seenAt: "desc",
        },
        skip: keepCount,
        select: {
          seenAt: true,
        },
      });

      if (!staleSeenAt.length) {
        continue;
      }

      const result = await prisma.equipmentLoginStatus.deleteMany({
        where: {
          source: sourceRow.source,
          seenAt: {
            in: staleSeenAt.map((row) => row.seenAt),
          },
        },
      });
      deleted += result.count;
    }

    return deleted;
  }

  private async trimYtCountSnapshotHistory(keepCount: number): Promise<number> {
    const sources = await prisma.yTCountSnapshot.findMany({
      distinct: ["source"],
      select: {
        source: true,
      },
    });

    let deleted = 0;
    for (const sourceRow of sources) {
      const staleSeenAt = await prisma.yTCountSnapshot.findMany({
        where: { source: sourceRow.source },
        distinct: ["seenAt"],
        orderBy: {
          seenAt: "desc",
        },
        skip: keepCount,
        select: {
          seenAt: true,
        },
      });

      if (!staleSeenAt.length) {
        continue;
      }

      const result = await prisma.yTCountSnapshot.deleteMany({
        where: {
          source: sourceRow.source,
          seenAt: {
            in: staleSeenAt.map((row) => row.seenAt),
          },
        },
      });
      deleted += result.count;
    }

    return deleted;
  }

  private async trimWeatherNoticeSnapshotHistory(keepCount: number): Promise<number> {
    const sources = await prisma.weatherNoticeSnapshot.findMany({
      distinct: ["source"],
      select: {
        source: true,
      },
    });

    let deleted = 0;
    for (const sourceRow of sources) {
      const staleSeenAt = await prisma.weatherNoticeSnapshot.findMany({
        where: { source: sourceRow.source },
        distinct: ["seenAt"],
        orderBy: {
          seenAt: "desc",
        },
        skip: keepCount,
        select: {
          seenAt: true,
        },
      });

      if (!staleSeenAt.length) {
        continue;
      }

      const result = await prisma.weatherNoticeSnapshot.deleteMany({
        where: {
          source: sourceRow.source,
          seenAt: {
            in: staleSeenAt.map((row) => row.seenAt),
          },
        },
      });
      deleted += result.count;
    }

    return deleted;
  }

  async registerDevice(input: DeviceRegistration) {
    const existing = await prisma.deviceRegistration.findUnique({
      where: { deviceId: input.deviceId },
    });

    if (existing) {
      return prisma.deviceRegistration.update({
        where: { deviceId: input.deviceId },
        data: {
          platform: input.platform,
          expoPushToken: input.expoPushToken,
          timezone: input.timezone,
          appVersion: input.appVersion,
        },
      });
    }

    return prisma.deviceRegistration.create({
      data: {
        deviceId: input.deviceId,
        platform: input.platform,
        expoPushToken: input.expoPushToken,
        timezone: input.timezone,
        appVersion: input.appVersion,
        alertsEnabled: input.alertsEnabled,
        bannerEnabled: input.bannerEnabled,
        themeMode: input.themeMode,
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
      bannerEnabled?: boolean;
      themeMode?: "system" | "dark" | "light";
      quietHoursFrom?: string | null;
      quietHoursTo?: string | null;
      categoryPrefs?: Record<string, boolean>;
    },
  ) {
    return prisma.deviceRegistration.update({
      where: { deviceId },
      data: {
        alertsEnabled: settings.alertsEnabled,
        bannerEnabled: settings.bannerEnabled,
        themeMode: settings.themeMode,
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
