import { formatGwctEtaAdjustmentMessage, type SourceId } from "@gwct/shared";
import type { FastifyBaseLogger } from "fastify";
import { env } from "../config/env.js";
import type { Repository, AlertEventInput } from "../db/repository.js";
import {
  detectGcEquipmentFocusEvents,
  detectGcRemainingLowEvents,
  detectGwctEtaChangedEvents,
  detectYtCountStateEvents,
  detectYtUnitStatusEvents,
  diffVesselItems,
  diffWeather,
} from "../engine/diff.js";
import { parseBySource } from "../parsers/index.js";
import { sha256 } from "../lib/hash.js";
import type { NotificationService } from "../notifications/service.js";
import { shouldDispatchRealtimeNotification } from "../notifications/policy.js";
import type { HtmlFetcher } from "../scraper/fetcher.js";
import { SOURCE_DEFINITIONS, type SourceDefinition } from "../scraper/sources.js";
import { saveGcLatestSnapshot, summarizeGcRange, type GcRemainingSnapshot } from "./gc/latestStore.js";
import {
  saveScheduleFocusSnapshot,
  summarizeScheduleFocus,
  type ScheduleFocusSnapshot,
} from "./scheduleFocus/latestStore.js";
import {
  loadEquipmentLatestSnapshot,
  saveEquipmentLatestSnapshot,
  summarizeEquipmentFocus,
  type EquipmentFocusSnapshot,
} from "./equipment/latestStore.js";
import { buildYtUnitSnapshotFromEquipment, countLoggedInYtUnits } from "./equipment/ytUnits.js";
import {
  loadMonitorSettings,
  setYeosuObservedState,
  setYtMonitorState,
} from "./monitorConfig/store.js";
import { observeYtWorkSnapshot } from "./ytWorkTime/service.js";
import { buildEffectiveYeosuSnapshot, buildYeosuObservedText } from "./yeosu/effectiveState.js";
import { saveVesselEtaAdjustmentRecord } from "./vessels/etaAdjustmentStore.js";
import {
  buildNextGcAssignmentState,
  loadGcAssignmentState,
  saveGcAssignmentState,
} from "./gc/assignmentStore.js";

export interface RunOptions {
  mode?: "live" | "fixture";
  fixtureSet?: string;
}

export class MonitorService {
  constructor(
    private readonly repo: Repository,
    private readonly fetcher: HtmlFetcher,
    private readonly notificationService: NotificationService,
    private readonly logger: FastifyBaseLogger,
  ) {}

  async runAllOnce(options: RunOptions = {}): Promise<void> {
    for (const sourceDef of SOURCE_DEFINITIONS) {
      await this.runSourceOnce(sourceDef, options);
    }
  }

  async runSourceOnce(sourceDef: SourceDefinition, options: RunOptions = {}): Promise<void> {
    const mode = options.mode || env.MODE;
    const run = await this.repo.startScrapeRun(sourceDef.source, sourceDef.url, mode);
    const started = Date.now();
    let fetchResult: Awaited<ReturnType<HtmlFetcher["fetch"]>> | null = null;
    let htmlHash: string | null = null;
    let rawSnapshotPersisted = false;
    let previousEquipmentLatestSnapshot: EquipmentFocusSnapshot | null = null;

    try {
      fetchResult = await this.fetcher.fetch(sourceDef.source, sourceDef.url, {
        mode,
        fixtureSet: options.fixtureSet,
      });

      htmlHash = sha256(fetchResult.html);

      const seenAt = new Date().toISOString();
      const bundle = parseBySource(sourceDef.source, fetchResult.html, seenAt);

      if (this.shouldPersistRawSnapshot(bundle.diagnostics.length, false)) {
        await this.repo.saveRawSnapshot({
          source: sourceDef.source,
          url: fetchResult.url,
          html: fetchResult.html,
          htmlHash,
          textContent: undefined,
          metadata: fetchResult.metadata,
          runId: run.id,
        });
        rawSnapshotPersisted = true;
      }

      if (sourceDef.source === "gwct_schedule_list" && fetchResult.metadata.scheduleRowsMeta) {
        this.logger.debug(
          {
            source: "gwct_schedule_list",
            rowClassification: fetchResult.metadata.scheduleRowsMeta,
          },
          "schedule row color classification",
        );
      }

      for (const diagnostic of bundle.diagnostics) {
        await this.repo.saveParseError({
          source: sourceDef.source,
          parserName: diagnostic.parserName,
          reason: diagnostic.reason,
          diagnostics: diagnostic.diagnostics,
          htmlHash,
          runId: run.id,
        });
      }

      if (sourceDef.source === "gwct_gc_remaining") {
        await this.persistGcLatestSnapshot(bundle.cranes, seenAt, fetchResult.url);
      }
      if (sourceDef.source === "gwct_schedule_list") {
        await this.persistScheduleFocusSnapshot(bundle.vessels, seenAt, fetchResult.url);
      }
      if (sourceDef.source === "gwct_equipment_status") {
        previousEquipmentLatestSnapshot = await loadEquipmentLatestSnapshot();
        await this.persistEquipmentLatestSnapshot(
          bundle.equipment,
          seenAt,
          fetchResult.url,
          previousEquipmentLatestSnapshot,
        );
      }

      const events = await this.persistAndBuildEvents(
        sourceDef.source,
        bundle,
        seenAt,
        fetchResult.url,
        previousEquipmentLatestSnapshot,
      );
      await this.emitEvents(events, seenAt);

      await this.repo.finishScrapeRun(run.id, {
        success: true,
        statusCode: fetchResult.statusCode,
        durationMs: Date.now() - started,
        htmlHash,
      });

      this.logger.info(
        {
          source: sourceDef.source,
          vesselCount: bundle.vessels.length,
          craneCount: bundle.cranes.length,
          equipmentCount: bundle.equipment.length,
          yt: bundle.yt?.totalLoggedIn,
          weatherState: bundle.weather?.suspensionState,
          emittedEvents: events.length,
        },
        "scrape source complete",
      );
    } catch (error) {
      const message = String((error as Error)?.message || error);

      if (fetchResult && htmlHash && !rawSnapshotPersisted && this.shouldPersistRawSnapshot(0, true)) {
        try {
          await this.repo.saveRawSnapshot({
            source: sourceDef.source,
            url: fetchResult.url,
            html: fetchResult.html,
            htmlHash,
            textContent: undefined,
            metadata: fetchResult.metadata,
            runId: run.id,
          });
        } catch (rawPersistError) {
          this.logger.warn(
            {
              source: sourceDef.source,
              err: String((rawPersistError as Error)?.message || rawPersistError),
            },
            "failed to persist raw snapshot in failure path",
          );
        }
      }

      await this.repo.saveParseError({
        source: sourceDef.source,
        parserName: "runSourceOnce",
        reason: message,
        diagnostics: {
          stack: (error as Error)?.stack,
        },
        htmlHash: htmlHash || undefined,
        runId: run.id,
      });
      await this.repo.finishScrapeRun(run.id, {
        success: false,
        durationMs: Date.now() - started,
        htmlHash: htmlHash || undefined,
        statusCode: fetchResult?.statusCode ?? null,
        errorMessage: message,
      });
      this.logger.error({ source: sourceDef.source, err: message }, "scrape source failed");
    }
  }

  private shouldPersistRawSnapshot(diagnosticsCount: number, failed: boolean): boolean {
    if (env.rawSnapshotPersist === "all") {
      return true;
    }
    if (env.rawSnapshotPersist === "off") {
      return false;
    }
    if (failed) {
      return true;
    }
    return diagnosticsCount > 0;
  }

  private async persistGcLatestSnapshot(cranes: ReturnType<typeof parseBySource>["cranes"], capturedAt: string, sourceUrl: string): Promise<void> {
    const items: GcRemainingSnapshot["items"] = [];
    const missing: string[] = [];
    let availableSubtotalCount = 0;

    for (let gc = 181; gc <= 190; gc += 1) {
      const row = cranes.find((item) => item.craneId === `GC${gc}`);
      const discharge = row?.dischargeRemaining ?? null;
      const load = row?.loadRemaining ?? null;
      const subtotal =
        discharge !== null || load !== null
          ? (discharge ?? 0) + (load ?? 0)
          : null;

      items.push({
        gc,
        dischargeRemaining: discharge,
        loadRemaining: load,
        remainingSubtotal: subtotal,
      });

      if (discharge === null) {
        missing.push(`GC${gc}:discharge`);
      } else {
        availableSubtotalCount += 1;
      }
      if (load === null) {
        missing.push(`GC${gc}:load`);
      } else {
        availableSubtotalCount += 1;
      }
    }

    const snapshot: GcRemainingSnapshot = {
      source: "gwct_gc_remaining",
      sourceUrl,
      capturedAt,
      items,
    };

    await saveGcLatestSnapshot(snapshot);

    this.logger.info(
      {
        source: "gwct_gc_remaining",
        summary: summarizeGcRange(snapshot, 183, 188),
      },
      "gc remaining summary",
    );

    if (availableSubtotalCount === 0) {
      this.logger.warn(
        {
          source: "gwct_gc_remaining",
          availableSubtotalCount,
          missing,
        },
        "gc remaining subtotal unavailable for all discharge/load pairs",
      );
      return;
    }

    if (missing.length) {
      this.logger.debug(
        {
          source: "gwct_gc_remaining",
          availableSubtotalCount,
          missingCount: missing.length,
          missingSample: missing.slice(0, 8),
        },
        "gc remaining partial subtotal missing",
      );
    }
  }

  private async persistScheduleFocusSnapshot(
    vessels: ReturnType<typeof parseBySource>["vessels"],
    capturedAt: string,
    sourceUrl: string,
  ): Promise<void> {
    const items: ScheduleFocusSnapshot["items"] = vessels.map((item, index) => {
      const rawIndex = Number(item.rawLabelMap?._watchIndex || index + 1);
      const indexInWatchWindow = Number.isInteger(rawIndex) && rawIndex > 0 ? rawIndex : index + 1;
      const etaNormalized =
        typeof item.rawLabelMap?._etaNormalized === "string" && item.rawLabelMap._etaNormalized.trim().length
          ? item.rawLabelMap._etaNormalized.trim()
          : null;
      const rowColorRaw = typeof item.rawLabelMap?._rowColor === "string" ? item.rawLabelMap._rowColor : "unknown";
      const rowColor = ["green", "yellow", "cyan", "unknown"].includes(rowColorRaw)
        ? (rowColorRaw as ScheduleFocusSnapshot["items"][number]["rowColor"])
        : "unknown";
      return {
        indexInWatchWindow,
        voyage: item.terminalVoyage || item.vesselKey,
        vesselName: item.vesselName,
        eta: item.eta,
        etaNormalized,
        rowColor,
        rowClass: typeof item.rawLabelMap?._rowClass === "string" ? item.rawLabelMap._rowClass : null,
      };
    });

    const startReasonRaw = vessels[0]?.rawLabelMap?._watchStartReason;
    const startReason =
      startReasonRaw === "first_yellow" || startReasonRaw === "first_non_green" || startReasonRaw === "none"
        ? startReasonRaw
        : "none";

    const snapshot: ScheduleFocusSnapshot = {
      source: "gwct_schedule_list",
      sourceUrl,
      capturedAt,
      startReason,
      items,
    };

    await saveScheduleFocusSnapshot(snapshot);

    this.logger.info(
      {
        source: "gwct_schedule_list",
        summary: summarizeScheduleFocus(snapshot),
      },
      "schedule11 summary",
    );

    this.logger.debug(
      {
        source: "gwct_schedule_list",
        rows: snapshot.items.map((item) => ({
          index: item.indexInWatchWindow,
          voyage: item.voyage,
          color: item.rowColor,
          className: item.rowClass,
        })),
      },
      "schedule11 row classification",
    );
  }

  private async persistAndBuildEvents(
    source: SourceId,
    bundle: ReturnType<typeof parseBySource>,
    occurredAt: string,
    sourceUrl: string,
    previousEquipmentLatestSnapshot: EquipmentFocusSnapshot | null = null,
  ): Promise<AlertEventInput[]> {
    const alerts: AlertEventInput[] = [];
    const monitorSettings = await loadMonitorSettings();

    if (bundle.vessels.length) {
      const prev = await this.repo.getLatestVesselItems(source);
      await this.repo.saveVesselItems(bundle.vessels);
      if (prev.length) {
        if (source === "gwct_schedule_list") {
          if (monitorSettings.gwctEtaMonitor.enabled) {
            alerts.push(
              ...detectGwctEtaChangedEvents(prev, bundle.vessels, source, occurredAt, {
                sourceUrl,
                emitOnWindowEntry: env.scheduleAlertOnWindowEnter,
                trackingCount: monitorSettings.gwctEtaMonitor.trackingCount,
              }),
            );
          }
        } else {
          alerts.push(...diffVesselItems(prev, bundle.vessels, source, occurredAt));
        }
      }
    }

    if (bundle.cranes.length) {
      const prev = await this.repo.getLatestCraneStatuses(source);
      await this.repo.saveCraneStatuses(bundle.cranes);
      if (source === "gwct_work_status") {
        const currentAssignmentState = await loadGcAssignmentState();
        const nextAssignmentState = buildNextGcAssignmentState(
          currentAssignmentState,
          prev,
          bundle.cranes,
          occurredAt,
        );
        await saveGcAssignmentState(nextAssignmentState);
      }
      if (prev.length) {
        if (source === "gwct_gc_remaining") {
          alerts.push(
            ...detectGcRemainingLowEvents(prev, bundle.cranes, monitorSettings.gcRemainingMonitors, source, occurredAt, {
              sourceUrl,
            }),
          );
        }
      }
    }

    let previousEquipmentRows: ReturnType<typeof parseBySource>["equipment"] = [];
    if (bundle.equipment.length) {
      previousEquipmentRows = await this.repo.getLatestEquipmentStatuses(source);
      await this.repo.saveEquipmentStatuses(bundle.equipment);
      if (previousEquipmentRows.length && monitorSettings.equipmentMonitor.gcStaff.enabled) {
        alerts.push(
          ...detectGcEquipmentFocusEvents(previousEquipmentRows, bundle.equipment, source, occurredAt, { sourceUrl }),
        );
      }
      if (previousEquipmentRows.length && monitorSettings.equipmentMonitor.yt.enabled) {
        const previousYtUnits =
          previousEquipmentLatestSnapshot?.ytUnits || buildYtUnitSnapshotFromEquipment(previousEquipmentRows);
        const currentYtUnits = buildYtUnitSnapshotFromEquipment(bundle.equipment, previousYtUnits, occurredAt);
        alerts.push(
          ...detectYtUnitStatusEvents(previousEquipmentRows, bundle.equipment, source, occurredAt, {
            sourceUrl,
            prevUnits: previousYtUnits,
            currUnits: currentYtUnits,
          }),
        );
      }
    }

    if (source === "gwct_equipment_status") {
      const previousYtSnapshot = await this.repo.getLatestYtSnapshot(source);
      const ytUnits = buildYtUnitSnapshotFromEquipment(
        bundle.equipment,
        previousEquipmentLatestSnapshot?.ytUnits || [],
        occurredAt,
      );
      const ytLoggedInCount = countLoggedInYtUnits(ytUnits);
      const ytSnapshot =
        ytUnits.length > 0
          ? {
              source,
              totalLoggedIn: ytLoggedInCount,
              totalKnown: ytUnits.length,
              threshold: monitorSettings.equipmentMonitor.yt.threshold,
              signature: sha256(
                JSON.stringify({
                  source,
                  totalLoggedIn: ytLoggedInCount,
                  totalKnown: ytUnits.length,
                  seenAt: occurredAt,
                }),
              ),
              seenAt: occurredAt,
            }
          : null;

      if (ytSnapshot) {
        await this.repo.saveYtSnapshot(ytSnapshot);
      }

      await observeYtWorkSnapshot(ytUnits, occurredAt);

      const ytTransition = detectYtCountStateEvents(ytSnapshot, monitorSettings.equipmentMonitor.yt, source, occurredAt, {
        sourceUrl,
        previousCount: previousYtSnapshot?.totalLoggedIn ?? null,
      });
      alerts.push(...ytTransition.events);
      if (
        !monitorSettings.equipmentMonitor.yt.stateInitialized ||
        monitorSettings.equipmentMonitor.yt.state !== ytTransition.nextState
      ) {
        await setYtMonitorState(ytTransition.nextState, ytTransition.initialized);
      }
    }

    if (bundle.weather) {
      const prev = await this.repo.getLatestWeatherSnapshot(source);
      let current = bundle.weather;

      if (source === "ys_forecast") {
        const [notice, news] = await Promise.all([
          this.repo.getLatestWeatherSnapshot("ys_notice"),
          this.repo.getLatestWeatherSnapshot("ys_news"),
        ]);
        current =
          buildEffectiveYeosuSnapshot({
            forecast: current,
            notice,
            news,
            fallbackState: monitorSettings.yeosuPilotageMonitor.lastNormalizedState,
          }) || current;
      }

      await this.repo.saveWeatherSnapshot(current);

      if (source === "ys_forecast") {
        const weatherText = buildYeosuObservedText(current);
        const weatherState = current.semanticState === "SUSPENDED" ? "all" : "none";
        const observedChanged =
          monitorSettings.yeosuPilotageMonitor.lastRawText !== weatherText ||
          monitorSettings.yeosuPilotageMonitor.lastNormalizedState !== weatherState;
        await setYeosuObservedState({
          lastRawText: weatherText,
          lastNormalizedState: weatherState,
          lastChangedAt: observedChanged ? occurredAt : monitorSettings.yeosuPilotageMonitor.lastChangedAt,
        });
      }

      if (source === "ys_forecast" && prev && monitorSettings.yeosuPilotageMonitor.enabled) {
        alerts.push(...diffWeather(prev, current, source, occurredAt));
      }
    }

    return alerts;
  }

  private async emitEvents(events: AlertEventInput[], seenAt: string): Promise<void> {
    const emitted: Array<{ id: string; event: AlertEventInput }> = [];
    const seenSemanticFingerprints = new Set<string>();

    for (const event of events) {
      const semanticFingerprint = `${event.source}:${event.type}:${event.dedupeKey}`;
      if (seenSemanticFingerprints.has(semanticFingerprint)) {
        continue;
      }
      seenSemanticFingerprints.add(semanticFingerprint);

      const preparedEvent = await this.decorateEtaAdjustmentEvent(event);
      const created = await this.repo.createAlertEvent(preparedEvent);
      await this.persistEtaAdjustmentState(preparedEvent);
      emitted.push({ id: created.id, event: preparedEvent });
      if (shouldDispatchRealtimeNotification(preparedEvent.type)) {
        await this.notificationService.dispatch(created.id, preparedEvent);
      }
    }

    if (emitted.length) {
      await this.repo.saveVesselChangeEvents(emitted.map((item) => item.event));
      await this.repo.saveEquipmentLoginEvents(emitted.map((item) => item.event));
      await this.repo.saveWeatherAlertEvents(emitted.map((item) => item.event));
    }
  }

  private async decorateEtaAdjustmentEvent(event: AlertEventInput): Promise<AlertEventInput> {
    if (event.type !== "gwct_eta_changed") {
      return event;
    }

    const vesselKey = typeof event.payload.vesselKey === "string" ? event.payload.vesselKey : null;
    const vesselName = typeof event.payload.vesselName === "string" ? event.payload.vesselName.trim() : "";
    const baseHumanMessage =
      typeof event.payload.humanMessage === "string" ? event.payload.humanMessage : null;

    if (!vesselKey || !baseHumanMessage) {
      return event;
    }

    const adjustmentCount = (await this.repo.countGwctEtaAdjustments(vesselKey)) + 1;
    const humanMessage = formatGwctEtaAdjustmentMessage(baseHumanMessage, adjustmentCount);

    return {
      ...event,
      message: `${vesselName || vesselKey} ${humanMessage}`,
      payload: {
        ...event.payload,
        adjustmentCount,
        humanMessage,
      },
    };
  }

  private async persistEtaAdjustmentState(event: AlertEventInput): Promise<void> {
    if (event.type !== "gwct_eta_changed") {
      return;
    }

    const payload = event.payload;
    const vesselKey = typeof payload.vesselKey === "string" ? payload.vesselKey : null;
    const vesselName = typeof payload.vesselName === "string" ? payload.vesselName : null;
    const previousEta = typeof payload.previousEta === "string" ? payload.previousEta : null;
    const currentEta = typeof payload.currentEta === "string" ? payload.currentEta : null;
    const deltaMinutes = typeof payload.deltaMinutes === "number" ? payload.deltaMinutes : null;
    const direction = payload.direction === "earlier" || payload.direction === "later" ? payload.direction : null;
    const humanMessage = typeof payload.humanMessage === "string" ? payload.humanMessage : null;
    const adjustmentCount =
      typeof payload.adjustmentCount === "number" && Number.isInteger(payload.adjustmentCount)
        ? payload.adjustmentCount
        : null;

    if (
      !vesselKey ||
      !vesselName ||
      !previousEta ||
      !currentEta ||
      deltaMinutes === null ||
      !direction ||
      !humanMessage ||
      !adjustmentCount
    ) {
      return;
    }

    await saveVesselEtaAdjustmentRecord({
      vesselKey,
      vesselName,
      voyage: typeof payload.voyage === "string" ? payload.voyage : null,
      occurredAt: event.occurredAt,
      previousEta,
      currentEta,
      deltaMinutes,
      direction,
      crossedDate: payload.crossedDate === true,
      humanMessage,
      adjustmentCount,
    });
  }

  private parseGcNoFromEquipmentId(equipmentId: string): number | null {
    const compact = equipmentId.toUpperCase().replace(/\s+/g, "");
    const matched = compact.match(/^G\/?C-?(\d{3})$/);
    if (!matched) {
      return null;
    }
    const parsed = Number(matched[1]);
    if (!Number.isInteger(parsed) || parsed < 180 || parsed > 190) {
      return null;
    }
    return parsed;
  }

  private normalizeOptionalValue(value: string | null | undefined): string | null {
    const text = (value || "").trim();
    if (!text) {
      return null;
    }
    const compactUpper = text.replace(/\s+/g, "").toUpperCase();
    if (compactUpper === "-" || compactUpper === "—" || compactUpper === "N/A" || compactUpper === "NA") {
      return null;
    }
    return text;
  }

  private async persistEquipmentLatestSnapshot(
    equipment: ReturnType<typeof parseBySource>["equipment"],
    capturedAt: string,
    sourceUrl: string,
    previousLatest: EquipmentFocusSnapshot | null = null,
  ): Promise<void> {
    const gcMap = new Map<number, EquipmentFocusSnapshot["gcStates"][number]>();
    for (const row of equipment) {
      const gcNo = this.parseGcNoFromEquipmentId(row.equipmentId);
      if (gcNo === null || gcMap.has(gcNo)) {
        continue;
      }
      gcMap.set(gcNo, {
        gcNo,
        equipmentId: `GC${gcNo}`,
        driverName: this.normalizeOptionalValue(row.operatorName),
        hkName: this.normalizeOptionalValue(row.helperName),
        loginTime: this.normalizeOptionalValue(row.loginText),
        stopReason: this.normalizeOptionalValue(row.stopReason),
      });
    }

    const gcStates: EquipmentFocusSnapshot["gcStates"] = [];
    for (let gcNo = 180; gcNo <= 190; gcNo += 1) {
      gcStates.push(
        gcMap.get(gcNo) || {
          gcNo,
          equipmentId: `GC${gcNo}`,
          driverName: null,
          hkName: null,
          loginTime: null,
          stopReason: null,
        },
      );
    }

    const ytUnits = buildYtUnitSnapshotFromEquipment(equipment, previousLatest?.ytUnits || [], capturedAt);

    const snapshot: EquipmentFocusSnapshot = {
      source: "gwct_equipment_status",
      sourceUrl,
      capturedAt,
      ytCount: countLoggedInYtUnits(ytUnits),
      ytKnown: ytUnits.length,
      ytUnits,
      gcStates,
    };

    await saveEquipmentLatestSnapshot(snapshot);

    this.logger.info(
      {
        source: "gwct_equipment_status",
        summary: summarizeEquipmentFocus(snapshot),
      },
      "equipment focus summary",
    );
  }
}


