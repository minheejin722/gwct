import { useEffect, useMemo, useRef, useState } from "react";
import {
  formatProgressThresholdPercent,
  normalizeProgressThresholdPercent,
  type CraneStatus,
  deriveProgressPercent,
} from "@gwct/shared";
import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import {
  Alert,
  Modal,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Svg, { Circle as SvgCircle, Defs, G, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TactilePressable } from "../components/TactilePressable";
import { useEndpoint } from "../hooks/useEndpoint";
import { useHeaderScrollToTop } from "../hooks/useHeaderScrollToTop";
import { reportDuplicateCraneRows } from "../lib/craneKeys";
import { useAppPreferences } from "../lib/appPreferences";
import { API_URLS } from "../lib/config";
import { fetchJson } from "../lib/fetchJson";

type GcWorkState = "active" | "checking" | "scheduled" | "idle" | "unknown";
type DisplayWorkState = "active" | "scheduled" | "idle";
type ViewMode = "map" | "list";

interface CraneLiveItem extends CraneStatus {
  workState: GcWorkState;
  crewAssigned: boolean;
}

interface CranesResponse {
  count: number;
  items: CraneLiveItem[];
}

interface VesselLiveItem {
  vesselKey: string;
  vesselName: string;
  berth: string | null;
}

interface VesselsResponse {
  count: number;
  items: VesselLiveItem[];
}

interface EquipmentLatestResponse {
  gcStates: Array<{
    gcNo: number;
    stopReason: string | null;
  }>;
}

interface CraneCardModel {
  cardKey: string;
  craneId: string;
  gcNo: number | null;
  workState: GcWorkState;
  crewAssigned: boolean;
  vessels: string[];
  vesselLabel: string;
  berthLabel: string | null;
  queueLabel: string | null;
  dischargeDone: number | null;
  loadDone: number | null;
  dischargeRemaining: number | null;
  loadRemaining: number | null;
  totalDone: number | null;
  totalRemaining: number | null;
  progressPercent: number | null;
  seenAt: string | null;
}

interface CraneSummaryModel {
  workingCount: number;
  scheduledCount: number;
  idleCount: number;
  overallPercent: number;
  dischargePercent: number;
  loadPercent: number;
}

interface StatusTone {
  label: string;
  badgeBackground: string;
  badgeBorder: string;
  badgeText: string;
  dot: string;
  meter: string;
  map: string;
  track: string;
}

interface OverviewPalette {
  solid: string;
  soft: string;
  stroke: string;
}

interface ProgressPercentMonitorRule {
  enabled: boolean;
  thresholdPercent: number;
}

interface ProgressMonitorConfigResponse {
  gcProgressMonitors: Record<string, ProgressPercentMonitorRule>;
  gcTotalProgressMonitor: ProgressPercentMonitorRule;
}

type ProgressAlertTarget =
  | {
      kind: "gc";
      gcKey: string;
      title: string;
      currentPercent: number | null;
    }
  | {
      kind: "total";
      title: string;
      currentPercent: number | null;
    };

const GC_NUMBERS = Array.from({ length: 10 }, (_, index) => 181 + index);
const MAP_GC_NUMBERS = [...GC_NUMBERS].reverse();
const DEFAULT_VIEW_MODE: ViewMode = "map";
const RECENT_COMPLETION_WINDOW_MS = 60 * 1000;
const RECENT_COMPLETION_PRUNE_INTERVAL_MS = 1000;
const MAP_CLUSTER_TONE_STEPS_FROM_RIGHT = [-0.28, -0.12, 0.08, 0.18, 0.26];
const DISCHARGE_METER_COLOR = "#e0b127";
const LOAD_METER_COLOR = "#ea7a2a";
const PROGRESS_ALERT_SCRUB_PIXELS_PER_STEP = 16;
const PROGRESS_ALERT_ACCELERATION_COOLDOWN_MS = 900;
const PROGRESS_ALERT_ACCELERATION_STEP = 0.45;
const PROGRESS_ALERT_ACCELERATION_MAX = 3.25;
const PROGRESS_ALERT_MIN_STEP_INDEX = 0;
const PROGRESS_ALERT_MAX_STEP_INDEX = 108;
const DEFAULT_PROGRESS_ALERT_RULE: ProgressPercentMonitorRule = {
  enabled: false,
  thresholdPercent: 100,
};
let lastSelectedCraneViewMode: ViewMode = DEFAULT_VIEW_MODE;
let recentCraneCompletionAtById: Record<string, number> = {};
let lastObservedCraneDisplayStateById: Record<string, DisplayWorkState> = {};

function workStatePriority(state: GcWorkState): number {
  if (state === "active") {
    return 0;
  }
  if (state === "checking") {
    return 1;
  }
  if (state === "scheduled") {
    return 2;
  }
  if (state === "unknown") {
    return 3;
  }
  return 4;
}

function parseGcNo(craneId: string): number | null {
  const matched = craneId.toUpperCase().replace(/\s+/g, "").match(/^GC(\d{3})$/);
  if (!matched) {
    return null;
  }
  const parsed = Number(matched[1]);
  return Number.isInteger(parsed) ? parsed : null;
}

function normalizeCardKeyPart(value: string | null | undefined): string {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "") || "none";
}

function clampColorChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function parseColorChannels(input: string): { r: number; g: number; b: number; a: number } | null {
  const color = input.trim();
  const hexMatched = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatched) {
    const raw = hexMatched[1];
    const hex = raw.length === 3 ? raw.split("").map((char) => `${char}${char}`).join("") : raw;
    const parsed = Number.parseInt(hex, 16);
    return {
      r: (parsed >> 16) & 255,
      g: (parsed >> 8) & 255,
      b: parsed & 255,
      a: 1,
    };
  }

  const rgbMatched = color.match(/^rgba?\((.+)\)$/i);
  if (!rgbMatched) {
    return null;
  }

  const parts = rgbMatched[1].split(",").map((part) => part.trim());
  if (parts.length < 3) {
    return null;
  }

  const r = Number.parseFloat(parts[0]);
  const g = Number.parseFloat(parts[1]);
  const b = Number.parseFloat(parts[2]);
  const a = parts[3] !== undefined ? Number.parseFloat(parts[3]) : 1;
  if (![r, g, b, a].every((value) => Number.isFinite(value))) {
    return null;
  }

  return { r, g, b, a };
}

function serializeColor(color: { r: number; g: number; b: number; a: number }): string {
  const r = clampColorChannel(color.r);
  const g = clampColorChannel(color.g);
  const b = clampColorChannel(color.b);
  const a = Math.max(0, Math.min(1, color.a));
  if (a >= 0.999) {
    return `rgb(${r}, ${g}, ${b})`;
  }
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
}

function blendColor(base: string, target: string, ratio: number): string {
  const from = parseColorChannels(base);
  const to = parseColorChannels(target);
  if (!from || !to) {
    return base;
  }
  const normalizedRatio = Math.max(0, Math.min(1, ratio));
  return serializeColor({
    r: from.r + (to.r - from.r) * normalizedRatio,
    g: from.g + (to.g - from.g) * normalizedRatio,
    b: from.b + (to.b - from.b) * normalizedRatio,
    a: from.a + (to.a - from.a) * normalizedRatio,
  });
}

function applyMapToneVariant(color: string, resolvedTheme: "light" | "dark", variant: number): string {
  if (!variant) {
    return color;
  }
  const target = variant > 0 ? "#ffffff" : resolvedTheme === "dark" ? "#000000" : "#111317";
  return blendColor(color, target, Math.abs(variant));
}

function sumNullable(values: Array<number | null | undefined>): number | null {
  let total = 0;
  let hasNumber = false;
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      total += value;
      hasNumber = true;
    }
  }
  return hasNumber ? total : null;
}

function areNumberMapsEqual(left: Record<string, number>, right: Record<string, number>): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  return leftKeys.every((key) => left[key] === right[key]);
}

function pruneRecentCompletionEntries(
  entries: Record<string, number>,
  now: number,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(entries).filter(([, completedAt]) => now - completedAt < RECENT_COMPLETION_WINDOW_MS),
  );
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => (value || "").replace(/\s+/g, " ").trim())
        .filter((value) => value.length > 0),
    ),
  );
}

function normalizeVesselLookupKey(value: string | null | undefined): string | null {
  const normalized = (value || "").replace(/\s+/g, " ").trim();
  return normalized ? normalized.toUpperCase() : null;
}

function buildVesselBerthLookup(items: VesselLiveItem[]): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const item of items) {
    const key = normalizeVesselLookupKey(item.vesselName);
    const berth = (item.berth || "").trim();
    if (!key || !berth || lookup.has(key)) {
      continue;
    }
    lookup.set(key, berth);
  }
  return lookup;
}

function buildBerthLabel(vessels: string[], berthLookup: Map<string, string>): string | null {
  const berths = uniqueStrings(
    vessels.map((vesselName) => {
      const key = normalizeVesselLookupKey(vesselName);
      return key ? berthLookup.get(key) || null : null;
    }),
  );
  if (!berths.length) {
    return null;
  }
  if (berths.length === 1) {
    return berths[0];
  }
  return `${berths[0]} +${berths.length - 1}`;
}

async function saveProgressMonitorConfig(
  payload: {
    gcProgressMonitors?: Record<string, Partial<ProgressPercentMonitorRule>>;
    gcTotalProgressMonitor?: Partial<ProgressPercentMonitorRule>;
  },
) {
  return fetchJson<ProgressMonitorConfigResponse>(API_URLS.monitorsConfig, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function gcProgressMonitorRule(
  data: ProgressMonitorConfigResponse | null,
  gcKey: string | null | undefined,
): ProgressPercentMonitorRule {
  if (!gcKey) {
    return DEFAULT_PROGRESS_ALERT_RULE;
  }
  return data?.gcProgressMonitors?.[gcKey] || DEFAULT_PROGRESS_ALERT_RULE;
}

function totalProgressMonitorRule(data: ProgressMonitorConfigResponse | null): ProgressPercentMonitorRule {
  return data?.gcTotalProgressMonitor || DEFAULT_PROGRESS_ALERT_RULE;
}

function mapVesselToneKey(card: CraneCardModel | null | undefined): string | null {
  if (!card) {
    return null;
  }
  return normalizeVesselLookupKey(card.vessels[0]) || null;
}

function buildMapCardToneOffsets(cards: Array<CraneCardModel | null>): Map<string, number> {
  const offsets = new Map<string, number>();
  let previousClusterKey: string | null = null;
  let currentClusterTone = 0;
  let clusterToneIndex = 0;

  for (let index = cards.length - 1; index >= 0; index -= 1) {
    const card = cards[index];
    const clusterKey = mapVesselToneKey(card);
    if (!card || !clusterKey) {
      previousClusterKey = null;
      continue;
    }

    if (clusterKey !== previousClusterKey) {
      currentClusterTone = MAP_CLUSTER_TONE_STEPS_FROM_RIGHT[clusterToneIndex % MAP_CLUSTER_TONE_STEPS_FROM_RIGHT.length] ?? 0;
      clusterToneIndex += 1;
      previousClusterKey = clusterKey;
    }

    offsets.set(card.cardKey, currentClusterTone);
  }

  return offsets;
}

function clampThresholdPercent(value: number): number {
  return normalizeProgressThresholdPercent(value, DEFAULT_PROGRESS_ALERT_RULE.thresholdPercent);
}

function formatThresholdPercent(value: number): string {
  return formatProgressThresholdPercent(value);
}

function thresholdPercentToStepIndex(value: number): number {
  const normalized = clampThresholdPercent(value);
  if (normalized >= 100) {
    return PROGRESS_ALERT_MAX_STEP_INDEX;
  }
  if (normalized >= 99 && normalized < 100) {
    return Math.max(
      PROGRESS_ALERT_MIN_STEP_INDEX,
      Math.min(PROGRESS_ALERT_MAX_STEP_INDEX, Math.round((normalized - 99) * 10) + 98),
    );
  }
  return Math.max(PROGRESS_ALERT_MIN_STEP_INDEX, Math.min(PROGRESS_ALERT_MAX_STEP_INDEX, Math.round(normalized) - 1));
}

function thresholdPercentFromStepIndex(stepIndex: number): number {
  const clampedIndex = Math.max(PROGRESS_ALERT_MIN_STEP_INDEX, Math.min(PROGRESS_ALERT_MAX_STEP_INDEX, stepIndex));
  if (clampedIndex >= PROGRESS_ALERT_MAX_STEP_INDEX) {
    return clampThresholdPercent(100);
  }
  if (clampedIndex >= 99) {
    return clampThresholdPercent(99 + (clampedIndex - 98) / 10);
  }
  return clampThresholdPercent(clampedIndex + 1);
}

function scrubStepDelta(dx: number): number {
  if (Math.abs(dx) < PROGRESS_ALERT_SCRUB_PIXELS_PER_STEP) {
    return 0;
  }
  if (dx > 0) {
    return Math.floor(dx / PROGRESS_ALERT_SCRUB_PIXELS_PER_STEP);
  }
  return Math.ceil(dx / PROGRESS_ALERT_SCRUB_PIXELS_PER_STEP);
}

function scrubAccelerationMultiplier(streakCount: number): number {
  if (streakCount <= 1) {
    return 1;
  }
  return Math.min(PROGRESS_ALERT_ACCELERATION_MAX, 1 + (streakCount - 1) * PROGRESS_ALERT_ACCELERATION_STEP);
}

function formatMetric(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "";
  }
  return value.toLocaleString();
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value && value.trim());
}

function buildGcStopReasonMap(rows: EquipmentLatestResponse["gcStates"] | undefined): Map<number, string> {
  const map = new Map<number, string>();
  for (const row of rows || []) {
    if (hasText(row.stopReason)) {
      map.set(row.gcNo, row.stopReason!.trim());
    }
  }
  return map;
}

function normalizeRemainingPair(
  dischargeRemaining: number | null | undefined,
  loadRemaining: number | null | undefined,
  totalRemaining: number | null | undefined,
) {
  let resolvedDischarge = typeof dischargeRemaining === "number" ? dischargeRemaining : null;
  let resolvedLoad = typeof loadRemaining === "number" ? loadRemaining : null;

  if (typeof totalRemaining === "number") {
    if (resolvedDischarge === null && resolvedLoad !== null) {
      resolvedDischarge = Math.max(totalRemaining - resolvedLoad, 0);
    }
    if (resolvedLoad === null && resolvedDischarge !== null) {
      resolvedLoad = Math.max(totalRemaining - resolvedDischarge, 0);
    }
  }

  return {
    dischargeRemaining: resolvedDischarge,
    loadRemaining: resolvedLoad,
  };
}

function formatUpdatedAt(value: string | null | undefined): string {
  if (!value) {
    return "--:--";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const now = new Date();
  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (isSameDay) {
    return `${hours}:${minutes}`;
  }
  return `${date.getMonth() + 1}/${date.getDate()} ${hours}:${minutes}`;
}

function displayWorkState(source: Pick<
  CraneCardModel,
  "workState" | "crewAssigned" | "vessels" | "totalDone" | "totalRemaining" | "dischargeRemaining" | "loadRemaining"
>): DisplayWorkState {
  if (source.workState === "active") {
    return "active";
  }
  if (source.workState === "idle") {
    return "idle";
  }
  if (source.workState === "unknown") {
    const hasLiveEvidence =
      typeof source.totalRemaining === "number" ||
      typeof source.dischargeRemaining === "number" ||
      typeof source.loadRemaining === "number" ||
      typeof source.totalDone === "number" ||
      source.vessels.length > 0;
    if (!hasLiveEvidence && !source.crewAssigned) {
      return "idle";
    }
  }
  return "scheduled";
}

function workStateLabel(state: DisplayWorkState): string {
  if (state === "active") {
    return "Working";
  }
  if (state === "scheduled") {
    return "Scheduled";
  }
  return "Idle";
}

function workStateHint(state: DisplayWorkState, crewAssigned: boolean): string {
  if (state === "active") {
    return crewAssigned ? "Crew assigned and operating live." : "Live work detected from the vessel queue.";
  }
  if (state === "scheduled") {
    return crewAssigned ? "Remaining work is queued on this crane." : "Queued next once crew logs in.";
  }
  return crewAssigned ? "Crew logged in with no remaining moves." : "No remaining work is assigned.";
}

function buildVesselLabel(vessels: string[]): string {
  if (!vessels.length) {
    return "No vessel assigned";
  }
  if (vessels.length === 1) {
    return vessels[0];
  }
  return `${vessels[0]} +${vessels.length - 1}`;
}

function buildGroupedCraneCardModels(items: CraneLiveItem[], berthLookup: Map<string, string>): CraneCardModel[] {
  const groups = new Map<string, CraneLiveItem[]>();
  for (const item of items) {
    const bucket = groups.get(item.craneId) || [];
    bucket.push(item);
    groups.set(item.craneId, bucket);
  }

  const cards = Array.from(groups.entries()).map(([craneId, rows]) => {
    const primary = [...rows].sort((left, right) => {
      const priorityDiff = workStatePriority(left.workState) - workStatePriority(right.workState);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      return (right.totalRemaining ?? 0) - (left.totalRemaining ?? 0);
    })[0];
    const dischargeDone = sumNullable(rows.map((row) => row.dischargeDone));
    const loadDone = sumNullable(rows.map((row) => row.loadDone));
    const dischargeRemaining = sumNullable(rows.map((row) => row.dischargeRemaining));
    const loadRemaining = sumNullable(rows.map((row) => row.loadRemaining));
    const totalDone = sumNullable([dischargeDone, loadDone]);
    const totalRemaining =
      sumNullable(rows.map((row) => row.totalRemaining)) ?? sumNullable([dischargeRemaining, loadRemaining]);
    const fallbackProgress = rows.find((row) => typeof row.progressPercent === "number")?.progressPercent ?? null;
    const vessels = uniqueStrings(rows.map((row) => row.vesselName));
    const latestSeenAt =
      rows
        .map((row) => Date.parse(row.seenAt))
        .filter((value) => Number.isFinite(value))
        .sort((left, right) => right - left)[0] ?? null;

    return {
      cardKey: craneId,
      craneId,
      gcNo: parseGcNo(craneId),
      workState: primary?.workState ?? "unknown",
      crewAssigned: rows.some((row) => row.crewAssigned),
      vessels,
      vesselLabel: buildVesselLabel(vessels),
      berthLabel: buildBerthLabel(vessels, berthLookup),
      queueLabel: vessels.length > 1 ? `${vessels.length} vessels queued on this crane.` : null,
      dischargeDone,
      loadDone,
      dischargeRemaining,
      loadRemaining,
      totalDone,
      totalRemaining,
      progressPercent: deriveProgressPercent(totalDone, totalRemaining, fallbackProgress),
      seenAt: latestSeenAt ? new Date(latestSeenAt).toISOString() : primary?.seenAt ?? null,
    } satisfies CraneCardModel;
  });

  return cards.sort((left, right) => {
    const priorityDiff = workStatePriority(left.workState) - workStatePriority(right.workState);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    return (left.gcNo ?? Number.MAX_SAFE_INTEGER) - (right.gcNo ?? Number.MAX_SAFE_INTEGER);
  });
}

function buildDisplayCraneCardModels(items: CraneLiveItem[], berthLookup: Map<string, string>): CraneCardModel[] {
  return items
    .map((item, index) => {
      const vessels = uniqueStrings([item.vesselName]);
      const dischargeDone = typeof item.dischargeDone === "number" ? item.dischargeDone : null;
      const loadDone = typeof item.loadDone === "number" ? item.loadDone : null;
      const dischargeRemaining = typeof item.dischargeRemaining === "number" ? item.dischargeRemaining : null;
      const loadRemaining = typeof item.loadRemaining === "number" ? item.loadRemaining : null;
      const totalDone = sumNullable([dischargeDone, loadDone]);
      const totalRemaining =
        typeof item.totalRemaining === "number"
          ? item.totalRemaining
          : sumNullable([dischargeRemaining, loadRemaining]);

      return {
        cardKey: [
          item.craneId,
          normalizeCardKeyPart(item.vesselName),
          normalizeCardKeyPart(item.seenAt),
          String(index),
        ].join(":"),
        craneId: item.craneId,
        gcNo: parseGcNo(item.craneId),
        workState: item.workState,
        crewAssigned: item.crewAssigned,
        vessels,
        vesselLabel: buildVesselLabel(vessels),
        berthLabel: buildBerthLabel(vessels, berthLookup),
        queueLabel: null,
        dischargeDone,
        loadDone,
        dischargeRemaining,
        loadRemaining,
        totalDone,
        totalRemaining,
        progressPercent: deriveProgressPercent(totalDone, totalRemaining, item.progressPercent),
        seenAt: item.seenAt || null,
      } satisfies CraneCardModel;
    })
    .sort((left, right) => {
      const priorityDiff = workStatePriority(left.workState) - workStatePriority(right.workState);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      const gcDiff = (left.gcNo ?? Number.MAX_SAFE_INTEGER) - (right.gcNo ?? Number.MAX_SAFE_INTEGER);
      if (gcDiff !== 0) {
        return gcDiff;
      }
      return left.cardKey.localeCompare(right.cardKey);
    });
}

function buildSummaryModel(cards: CraneCardModel[]): CraneSummaryModel {
  const totalDone = sumNullable(cards.map((card) => card.totalDone));
  const totalRemaining = sumNullable(cards.map((card) => card.totalRemaining));
  const dischargeDone = sumNullable(cards.map((card) => card.dischargeDone));
  const loadDone = sumNullable(cards.map((card) => card.loadDone));
  const displayStates = cards.map((card) => displayWorkState(card));
  const normalizedRemaining = cards.map((card) =>
    normalizeRemainingPair(card.dischargeRemaining, card.loadRemaining, card.totalRemaining),
  );
  const dischargeRemaining = sumNullable(normalizedRemaining.map((value) => value.dischargeRemaining));
  const loadRemaining = sumNullable(normalizedRemaining.map((value) => value.loadRemaining));

  return {
    workingCount: displayStates.filter((state) => state === "active").length,
    scheduledCount: displayStates.filter((state) => state === "scheduled").length,
    idleCount: displayStates.filter((state) => state === "idle").length,
    overallPercent: deriveProgressPercent(totalDone, totalRemaining) ?? 0,
    dischargePercent: deriveProgressPercent(dischargeDone, dischargeRemaining) ?? 0,
    loadPercent: deriveProgressPercent(loadDone, loadRemaining) ?? 0,
  };
}

function craneCardDisplayRank(card: CraneCardModel, recentCompletionCraneIds: Set<string>): number {
  const displayState = displayWorkState(card);
  if (displayState === "active") {
    return 0;
  }
  if (displayState === "scheduled") {
    return 1;
  }
  if (recentCompletionCraneIds.has(card.craneId)) {
    return 2;
  }
  return 3;
}

function sortCraneCardsForDisplay(cards: CraneCardModel[], recentCompletionCraneIds: Set<string>): CraneCardModel[] {
  return [...cards].sort((left, right) => {
    const rankDiff =
      craneCardDisplayRank(left, recentCompletionCraneIds) - craneCardDisplayRank(right, recentCompletionCraneIds);
    if (rankDiff !== 0) {
      return rankDiff;
    }
    const gcDiff = (left.gcNo ?? Number.MAX_SAFE_INTEGER) - (right.gcNo ?? Number.MAX_SAFE_INTEGER);
    if (gcDiff !== 0) {
      return gcDiff;
    }
    return left.cardKey.localeCompare(right.cardKey);
  });
}

function isIdleCompletionCandidate(card: CraneCardModel, displayState: DisplayWorkState): boolean {
  return displayState === "idle" && card.totalRemaining === 0 && typeof card.totalDone === "number" && card.totalDone > 0;
}

function stateTone(
  state: DisplayWorkState,
  resolvedTheme: "light" | "dark",
  colors: ReturnType<typeof useAppPreferences>["colors"],
): StatusTone {
  if (state === "active") {
    return {
      label: "Working",
      badgeBackground: resolvedTheme === "dark" ? "#24995a" : "#45c573",
      badgeBorder: resolvedTheme === "dark" ? "#4ed084" : "#8bdca7",
      badgeText: "#ffffff",
      dot: resolvedTheme === "dark" ? "#63de8e" : "#39c66d",
      meter: resolvedTheme === "dark" ? "#63de8e" : "#39c66d",
      map: resolvedTheme === "dark" ? "#44c778" : "#4dcb79",
      track: resolvedTheme === "dark" ? "rgba(99,222,142,0.20)" : "#d7f2df",
    };
  }
  if (state === "scheduled") {
    return {
      label: "Scheduled",
      badgeBackground: resolvedTheme === "dark" ? "#277fd8" : "#2e90ed",
      badgeBorder: resolvedTheme === "dark" ? "#59aaf5" : "#83bdf7",
      badgeText: "#ffffff",
      dot: resolvedTheme === "dark" ? "#59aaf5" : "#2e90ed",
      meter: resolvedTheme === "dark" ? "#59aaf5" : "#2e90ed",
      map: resolvedTheme === "dark" ? "#4398ed" : "#3897ef",
      track: resolvedTheme === "dark" ? "rgba(89,170,245,0.18)" : "#d8ebfd",
    };
  }
  return {
    label: "Idle",
    badgeBackground: resolvedTheme === "dark" ? "#6b7480" : "#9da3ae",
    badgeBorder: resolvedTheme === "dark" ? "#959daa" : "#c7ccd4",
    badgeText: "#ffffff",
    dot: resolvedTheme === "dark" ? "#a5adba" : "#9da3ae",
    meter: resolvedTheme === "dark" ? "#9aa2af" : "#9da3ae",
    map: resolvedTheme === "dark" ? "#8b93a0" : "#a6adb7",
    track: resolvedTheme === "dark" ? "rgba(165,173,186,0.18)" : "#e4e7ec",
  };
}

function createOverviewPalette(
  state: DisplayWorkState,
  resolvedTheme: "light" | "dark",
  colors: ReturnType<typeof useAppPreferences>["colors"],
  vesselToneVariant = 0,
): OverviewPalette {
  const tone = stateTone(state, resolvedTheme, colors);
  return {
    solid: applyMapToneVariant(tone.map, resolvedTheme, vesselToneVariant),
    soft: applyMapToneVariant(tone.track, resolvedTheme, vesselToneVariant * 0.72),
    stroke: resolvedTheme === "dark" ? "#10161d" : "#2a3138",
  };
}

function createRecentCompletionPalette(resolvedTheme: "light" | "dark"): OverviewPalette {
  return {
    solid: resolvedTheme === "dark" ? "#111317" : "#101216",
    soft: resolvedTheme === "dark" ? "#565d68" : "#606775",
    stroke: resolvedTheme === "dark" ? "#d7dde6" : "#111317",
  };
}

function createStopReasonPalette(resolvedTheme: "light" | "dark"): OverviewPalette {
  return {
    solid: resolvedTheme === "dark" ? "#d94b54" : "#df4040",
    soft: resolvedTheme === "dark" ? "#f08a8a" : "#f2a0a0",
    stroke: resolvedTheme === "dark" ? "#ffe3e3" : "#611717",
  };
}

function stopReasonTone(resolvedTheme: "light" | "dark"): StatusTone {
  return {
    label: "Stopped",
    badgeBackground: resolvedTheme === "dark" ? "#bf434d" : "#df4040",
    badgeBorder: resolvedTheme === "dark" ? "#f08a8a" : "#f2a0a0",
    badgeText: "#ffffff",
    dot: resolvedTheme === "dark" ? "#f08a8a" : "#df4040",
    meter: resolvedTheme === "dark" ? "#f08a8a" : "#df4040",
    map: resolvedTheme === "dark" ? "#d94b54" : "#df4040",
    track: resolvedTheme === "dark" ? "rgba(240,138,138,0.18)" : "#f9d9d9",
  };
}

export default function CranesScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors, resolvedTheme } = useAppPreferences();
  const styles = useMemo(() => createStyles(colors, resolvedTheme), [colors, resolvedTheme]);
  const meterTrackColor = resolvedTheme === "dark" ? "#3a4652" : "#dfe4ea";
  const scrollRef = useRef<ScrollView | null>(null);
  const previousDisplayStatesRef = useRef<Record<string, DisplayWorkState>>(lastObservedCraneDisplayStateById);
  const [viewMode, setViewModeState] = useState<ViewMode>(() => lastSelectedCraneViewMode);
  const [recentCompletionAtByCraneId, setRecentCompletionAtByCraneId] = useState<Record<string, number>>(() =>
    pruneRecentCompletionEntries(recentCraneCompletionAtById, Date.now()),
  );
  const [progressAlertTarget, setProgressAlertTarget] = useState<ProgressAlertTarget | null>(null);
  const [progressAlertThresholdDraft, setProgressAlertThresholdDraft] = useState<number>(
    DEFAULT_PROGRESS_ALERT_RULE.thresholdPercent,
  );
  const [savingProgressAlert, setSavingProgressAlert] = useState(false);
  const {
    data,
    error,
    loading: cranesLoading,
    refresh: refreshCranes,
    updatedAt,
  } = useEndpoint<CranesResponse>(API_URLS.cranes, {
    pollMs: 5000,
    liveSources: ["gwct_gc_remaining", "gwct_work_status", "gwct_equipment_status"],
  });
  const { data: vesselsData, loading: vesselsLoading, refresh: refreshVessels } = useEndpoint<VesselsResponse>(
    API_URLS.vessels,
    {
      pollMs: 5000,
      liveSources: ["gwct_schedule_list"],
    },
  );
  const {
    data: equipmentData,
    loading: equipmentLoading,
    refresh: refreshEquipment,
  } = useEndpoint<EquipmentLatestResponse>(API_URLS.equipmentLatest, {
    pollMs: 5000,
    liveSources: ["gwct_equipment_status"],
  });
  const {
    data: progressMonitorConfig,
    refresh: refreshProgressMonitorConfig,
    setData: setProgressMonitorConfig,
  } = useEndpoint<ProgressMonitorConfigResponse>(API_URLS.monitorsConfig);
  const items = data?.items || [];
  const vesselBerthLookup = useMemo(() => buildVesselBerthLookup(vesselsData?.items || []), [vesselsData?.items]);
  const stopReasonByGcNo = useMemo(() => buildGcStopReasonMap(equipmentData?.gcStates), [equipmentData?.gcStates]);
  const groupedCards = useMemo(() => buildGroupedCraneCardModels(items, vesselBerthLookup), [items, vesselBerthLookup]);
  const displayCardRows = useMemo(
    () => buildDisplayCraneCardModels(items, vesselBerthLookup),
    [items, vesselBerthLookup],
  );
  const summary = useMemo(() => buildSummaryModel(groupedCards), [groupedCards]);
  const latestSeenAt = useMemo(() => {
    const latestMillis =
      groupedCards
        .map((card) => Date.parse(card.seenAt || ""))
        .filter((value) => Number.isFinite(value))
        .sort((left, right) => right - left)[0] ?? null;
    return latestMillis ? new Date(latestMillis).toISOString() : updatedAt;
  }, [groupedCards, updatedAt]);
  const heroVesselLabel = useMemo(() => {
    const activeFirst = groupedCards
      .filter((card) => card.workState === "active")
      .flatMap((card) => card.vessels);
    const queued = groupedCards.flatMap((card) => card.vessels);
    return buildVesselLabel(uniqueStrings(activeFirst.length ? activeFirst : queued));
  }, [groupedCards]);
  const minimalMapCards = viewMode === "map";
  const twoColumnCards = minimalMapCards && width >= 360;

  useEffect(() => {
    reportDuplicateCraneRows(items);
  }, [items]);

  const setViewMode = (next: ViewMode) => {
    lastSelectedCraneViewMode = next;
    setViewModeState(next);
  };

  const closeProgressAlertPicker = () => {
    if (savingProgressAlert) {
      return;
    }
    setProgressAlertTarget(null);
  };

  const openGcProgressAlertPicker = (card: CraneCardModel) => {
    const gcKey = card.gcNo !== null ? String(card.gcNo) : null;
    if (!gcKey) {
      return;
    }
    const rule = gcProgressMonitorRule(progressMonitorConfig, gcKey);
    const threshold = clampThresholdPercent(rule.thresholdPercent);
    setProgressAlertThresholdDraft(threshold);
    setProgressAlertTarget({
      kind: "gc",
      gcKey,
      title: card.craneId,
      currentPercent: card.progressPercent,
    });
  };

  const openTotalProgressAlertPicker = () => {
    const rule = totalProgressMonitorRule(progressMonitorConfig);
    const threshold = clampThresholdPercent(rule.thresholdPercent);
    setProgressAlertThresholdDraft(threshold);
    setProgressAlertTarget({
      kind: "total",
      title: "Total Progress",
      currentPercent: summary.overallPercent,
    });
  };

  const saveProgressAlertRule = async () => {
    if (!progressAlertTarget) {
      return;
    }
    setSavingProgressAlert(true);
    try {
      const saved =
        progressAlertTarget.kind === "gc"
          ? await saveProgressMonitorConfig({
              gcProgressMonitors: {
                [progressAlertTarget.gcKey]: {
                  enabled: true,
                  thresholdPercent: clampThresholdPercent(progressAlertThresholdDraft),
                },
              },
            })
          : await saveProgressMonitorConfig({
              gcTotalProgressMonitor: {
                enabled: true,
                thresholdPercent: clampThresholdPercent(progressAlertThresholdDraft),
              },
            });
      setProgressMonitorConfig(saved);
      setProgressAlertTarget(null);
      void refreshProgressMonitorConfig({ silent: true });
    } catch (saveError) {
      Alert.alert("Save failed", (saveError as Error).message);
    } finally {
      setSavingProgressAlert(false);
    }
  };

  const disableProgressAlertRule = async () => {
    if (!progressAlertTarget) {
      return;
    }
    setSavingProgressAlert(true);
    try {
      const saved =
        progressAlertTarget.kind === "gc"
          ? await saveProgressMonitorConfig({
              gcProgressMonitors: {
                [progressAlertTarget.gcKey]: {
                  enabled: false,
                },
              },
            })
          : await saveProgressMonitorConfig({
              gcTotalProgressMonitor: {
                enabled: false,
              },
            });
      setProgressMonitorConfig(saved);
      setProgressAlertTarget(null);
      void refreshProgressMonitorConfig({ silent: true });
    } catch (saveError) {
      Alert.alert("Save failed", (saveError as Error).message);
    } finally {
      setSavingProgressAlert(false);
    }
  };

  useEffect(() => {
    const now = Date.now();
    const nextRecent = pruneRecentCompletionEntries(recentCraneCompletionAtById, now);
    const nextDisplayStates: Record<string, DisplayWorkState> = {};

    for (const card of groupedCards) {
      const displayState = displayWorkState(card);
      nextDisplayStates[card.craneId] = displayState;
      const previousDisplayState = previousDisplayStatesRef.current[card.craneId];
      if (previousDisplayState && previousDisplayState !== "idle" && displayState === "idle") {
        nextRecent[card.craneId] = now;
      }
      if (!previousDisplayState && !nextRecent[card.craneId] && isIdleCompletionCandidate(card, displayState)) {
        nextRecent[card.craneId] = now;
      }
      if (displayState !== "idle") {
        delete nextRecent[card.craneId];
      }
    }

    previousDisplayStatesRef.current = nextDisplayStates;
    lastObservedCraneDisplayStateById = nextDisplayStates;
    recentCraneCompletionAtById = nextRecent;
    setRecentCompletionAtByCraneId((current) => (areNumberMapsEqual(current, nextRecent) ? current : nextRecent));
  }, [groupedCards]);

  useEffect(() => {
    const timer = setInterval(() => {
      const nextRecent = pruneRecentCompletionEntries(recentCraneCompletionAtById, Date.now());
      recentCraneCompletionAtById = nextRecent;
      setRecentCompletionAtByCraneId((current) => (areNumberMapsEqual(current, nextRecent) ? current : nextRecent));
    }, RECENT_COMPLETION_PRUNE_INTERVAL_MS);

    return () => {
      clearInterval(timer);
    };
  }, []);

  const recentCompletionCraneIds = useMemo(
    () => new Set(Object.keys(pruneRecentCompletionEntries(recentCompletionAtByCraneId, Date.now()))),
    [recentCompletionAtByCraneId],
  );
  const displayCards = useMemo(
    () => sortCraneCardsForDisplay(displayCardRows, recentCompletionCraneIds),
    [displayCardRows, recentCompletionCraneIds],
  );
  const totalProgressAlarmEnabled = totalProgressMonitorRule(progressMonitorConfig).enabled;

  useHeaderScrollToTop(["cranes"], scrollRef);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        ref={scrollRef}
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 12) + 18 }]}
        refreshControl={
          <RefreshControl
            refreshing={cranesLoading || vesselsLoading || equipmentLoading}
            onRefresh={() =>
              void Promise.all([refreshCranes(), refreshVessels(), refreshEquipment(), refreshProgressMonitorConfig()])
            }
            tintColor={colors.accentMuted}
            colors={[colors.badgeBackground]}
          />
        }
      >
        <View style={styles.headerSection}>
          <Text style={styles.eyebrow}>Crane Status</Text>
          <View style={styles.headerTopRow}>
            <Text style={styles.heroTitle}>Terminal Overview</Text>
            <View style={styles.segmentedControl}>
              <Pressable
                onPress={() => setViewMode("map")}
                style={[styles.segmentButton, viewMode === "map" ? styles.segmentButtonActive : null]}
              >
                <Text style={[styles.segmentText, viewMode === "map" ? styles.segmentTextActive : null]}>Map View</Text>
              </Pressable>
              <Pressable
                onPress={() => setViewMode("list")}
                style={[styles.segmentButton, viewMode === "list" ? styles.segmentButtonActive : null]}
              >
                <Text style={[styles.segmentText, viewMode === "list" ? styles.segmentTextActive : null]}>
                  List View
                </Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.updatedRow}>
            <View style={styles.updatedCopy}>
              <Text style={styles.updatedLabel}>Updated</Text>
              <Text style={styles.updatedValue}>{formatUpdatedAt(latestSeenAt)}</Text>
            </View>
            <Pressable
              onPress={() =>
                void Promise.all([refreshCranes(), refreshVessels(), refreshEquipment(), refreshProgressMonitorConfig()])
              }
              style={styles.refreshButton}
            >
              <Ionicons name="refresh-outline" size={22} color={colors.badgeBackground} />
            </Pressable>
          </View>
        </View>

        {viewMode === "map" ? (
          <View style={styles.mapCard}>
            <TerminalMapIllustration
              cards={groupedCards}
              colors={colors}
              recentCompletionCraneIds={recentCompletionCraneIds}
              resolvedTheme={resolvedTheme}
              stopReasonByGcNo={stopReasonByGcNo}
              vesselLabel={heroVesselLabel}
              styles={styles}
            />
          </View>
        ) : null}

        <View style={[styles.summaryCard, width < 390 ? styles.summaryCardStacked : null]}>
          <View style={styles.summaryColumn}>
            <Text style={styles.summaryTitle}>Crane Status Overview</Text>
            <View style={styles.summaryChipWrap}>
              <StatusChip
                count={summary.workingCount}
                state="active"
                colors={colors}
                resolvedTheme={resolvedTheme}
                styles={styles}
              />
              <StatusChip
                count={summary.scheduledCount}
                state="scheduled"
                colors={colors}
                resolvedTheme={resolvedTheme}
                styles={styles}
              />
              <StatusChip
                count={summary.idleCount}
                state="idle"
                colors={colors}
                resolvedTheme={resolvedTheme}
                styles={styles}
              />
            </View>
          </View>
          <View style={[styles.summaryDivider, width < 390 ? styles.summaryDividerHorizontal : null]} />
          <Pressable
            style={styles.summaryColumn}
            onLongPress={openTotalProgressAlertPicker}
            delayLongPress={220}
          >
            <View style={styles.summaryTopRow}>
              <Text style={styles.summaryTitle}>Total Progress</Text>
              <CraneAlarmBadge visible={totalProgressAlarmEnabled} styles={styles} />
            </View>
            <Text style={styles.progressHeadline}>{summary.overallPercent}% Complete</Text>
            <ProgressMeter
              label="Discharged"
              progress={summary.dischargePercent}
              fillColor={DISCHARGE_METER_COLOR}
              trackColor={meterTrackColor}
              styles={styles}
            />
            <ProgressMeter
              label="Loaded"
              progress={summary.loadPercent}
              fillColor={LOAD_METER_COLOR}
              trackColor={meterTrackColor}
              styles={styles}
            />
          </Pressable>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="warning-outline" size={18} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {displayCards.length ? (
          <View style={styles.cardsGrid}>
            {displayCards.map((card) => (
              <CraneCard
                key={card.cardKey}
                card={card}
                alarmEnabled={gcProgressMonitorRule(progressMonitorConfig, card.gcNo !== null ? String(card.gcNo) : null).enabled}
                stopFlagged={Boolean(card.gcNo !== null && hasText(stopReasonByGcNo.get(card.gcNo)))}
                colors={colors}
                resolvedTheme={resolvedTheme}
                compact={twoColumnCards}
                minimal={minimalMapCards}
                onLongPress={() => openGcProgressAlertPicker(card)}
                styles={styles}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No live crane rows yet.</Text>
            <Text style={styles.emptyBody}>Pull to refresh once the GWCT GC feed starts returning data.</Text>
          </View>
        )}
      </ScrollView>
      <Modal
        visible={progressAlertTarget !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeProgressAlertPicker}
      >
        <View style={styles.progressAlertModalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeProgressAlertPicker} />
          <View style={styles.progressAlertSheet}>
            <View style={styles.progressAlertHeader}>
              <View style={styles.progressAlertHeaderCopy}>
                <Text style={styles.progressAlertTitle}>{progressAlertTarget?.title || "Progress Alert"}</Text>
                <Text style={styles.progressAlertSubtitle}>
                  {typeof progressAlertTarget?.currentPercent === "number"
                    ? `Current progress ${progressAlertTarget.currentPercent}%`
                    : "Current progress unavailable"}
                </Text>
              </View>
              <Pressable hitSlop={8} onPress={closeProgressAlertPicker}>
                <Text style={styles.progressAlertClose}>Close</Text>
              </Pressable>
            </View>

            <ProgressAlertScrubCard
              key={progressAlertTarget ? `${progressAlertTarget.kind}:${progressAlertTarget.title}` : "progress-alert-scrub"}
              value={progressAlertThresholdDraft}
              onValueChange={setProgressAlertThresholdDraft}
              styles={styles}
            />

            <View style={styles.progressAlertActionRow}>
              <TactilePressable
                variant="compact"
                style={[
                  styles.progressAlertActionButton,
                  styles.progressAlertDisableButton,
                  savingProgressAlert ? styles.progressAlertActionDisabled : null,
                ]}
                onPress={() => void disableProgressAlertRule()}
                disabled={savingProgressAlert}
              >
                <Text style={styles.progressAlertDisableText}>Disable</Text>
              </TactilePressable>
              <TactilePressable
                variant="compact"
                style={[
                  styles.progressAlertActionButton,
                  styles.progressAlertSaveButton,
                  savingProgressAlert ? styles.progressAlertActionDisabled : null,
                ]}
                onPress={() => void saveProgressAlertRule()}
                disabled={savingProgressAlert}
              >
                <Text style={styles.progressAlertSaveText}>{savingProgressAlert ? "Saving..." : "Save"}</Text>
              </TactilePressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function StatusChip({
  count,
  state,
  colors,
  resolvedTheme,
  styles,
}: {
  count: number;
  state: DisplayWorkState;
  colors: ReturnType<typeof useAppPreferences>["colors"];
  resolvedTheme: "light" | "dark";
  styles: ReturnType<typeof createStyles>;
}) {
  const tone = stateTone(state, resolvedTheme, colors);

  return (
    <View style={[styles.statusChip, { backgroundColor: tone.badgeBackground, borderColor: tone.badgeBorder }]}>
      <Text style={[styles.statusChipText, { color: tone.badgeText }]}>
        {count} {tone.label}
      </Text>
    </View>
  );
}

function ProgressMeter({
  label,
  progress,
  fillColor,
  trackColor,
  styles,
}: {
  label: string;
  progress: number;
  fillColor: string;
  trackColor: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.meterBlock}>
      <View style={styles.meterCopyRow}>
        <Text style={styles.meterLabel}>{label}</Text>
        <Text style={styles.meterValue}>{progress}%</Text>
      </View>
      <View style={[styles.meterTrack, { backgroundColor: trackColor }]}>
        <View style={[styles.meterFill, { width: `${progress}%`, backgroundColor: fillColor }]} />
      </View>
    </View>
  );
}

function ProgressRing({
  size,
  progress,
  color,
  trackColor,
}: {
  size: number;
  progress: number;
  color: string;
  trackColor: string;
}) {
  const strokeWidth = Math.max(5, Math.round(size * 0.12));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (circumference * progress) / 100;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <SvgCircle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={trackColor}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <SvgCircle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={dashOffset}
        rotation="-90"
        origin={`${size / 2}, ${size / 2}`}
      />
    </Svg>
  );
}

function ProgressAlertScrubCard({
  value,
  onValueChange,
  styles,
}: {
  value: number;
  onValueChange: (value: number) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const normalizedValue = clampThresholdPercent(value);
  const currentStepIndexRef = useRef(thresholdPercentToStepIndex(normalizedValue));
  const dragStartStepIndexRef = useRef(currentStepIndexRef.current);
  const latestValueRef = useRef(normalizedValue);
  const dragStreakCountRef = useRef(0);
  const activeAccelerationRef = useRef(1);
  const lastDragEndedAtRef = useRef<number | null>(null);

  currentStepIndexRef.current = thresholdPercentToStepIndex(normalizedValue);
  latestValueRef.current = normalizedValue;

  const syncValueFromDelta = (dx: number) => {
    const adjustedDx = dx * activeAccelerationRef.current;
    const nextStepIndex = Math.max(
      PROGRESS_ALERT_MIN_STEP_INDEX,
      Math.min(PROGRESS_ALERT_MAX_STEP_INDEX, dragStartStepIndexRef.current + scrubStepDelta(adjustedDx)),
    );
    const nextValue = thresholdPercentFromStepIndex(nextStepIndex);
    if (Math.abs(nextValue - latestValueRef.current) > 0.001) {
      onValueChange(nextValue);
    }
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          const now = Date.now();
          const lastEndedAt = lastDragEndedAtRef.current;
          if (lastEndedAt !== null && now - lastEndedAt <= PROGRESS_ALERT_ACCELERATION_COOLDOWN_MS) {
            dragStreakCountRef.current += 1;
          } else {
            dragStreakCountRef.current = 1;
          }
          activeAccelerationRef.current = scrubAccelerationMultiplier(dragStreakCountRef.current);
          dragStartStepIndexRef.current = currentStepIndexRef.current;
        },
        onPanResponderMove: (_, gestureState) => {
          syncValueFromDelta(gestureState.dx);
        },
        onPanResponderRelease: (_, gestureState) => {
          syncValueFromDelta(gestureState.dx);
          lastDragEndedAtRef.current = Date.now();
        },
        onPanResponderTerminate: (_, gestureState) => {
          syncValueFromDelta(gestureState.dx);
          lastDragEndedAtRef.current = Date.now();
        },
        onPanResponderTerminationRequest: () => true,
      }),
    [onValueChange],
  );

  return (
    <View {...responder.panHandlers} style={styles.progressAlertValueCard}>
      <View
        style={[
          styles.progressAlertValueFill,
          normalizedValue >= 100 ? styles.progressAlertValueFillComplete : { width: `${normalizedValue}%` },
        ]}
      />
      <View style={styles.progressAlertValueSheen} />
      <Text style={styles.progressAlertHint}>Press and drag to nudge. Repeat quick drags to accelerate.</Text>
      <Text style={styles.progressAlertValue}>{formatThresholdPercent(normalizedValue)}</Text>
      <Text style={styles.progressAlertFineHint}>Decimals appear only in the final 1% before 100%.</Text>
    </View>
  );
}

function CraneAlarmBadge({
  visible,
  styles,
}: {
  visible: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  if (!visible) {
    return null;
  }

  return (
    <View style={styles.craneAlarmBadge}>
      <Ionicons name="notifications" size={14} color="#ffffff" />
    </View>
  );
}

function CraneCard({
  card,
  alarmEnabled,
  stopFlagged,
  colors,
  resolvedTheme,
  compact,
  minimal,
  onLongPress,
  styles,
}: {
  card: CraneCardModel;
  alarmEnabled: boolean;
  stopFlagged: boolean;
  colors: ReturnType<typeof useAppPreferences>["colors"];
  resolvedTheme: "light" | "dark";
  compact: boolean;
  minimal: boolean;
  onLongPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const displayState = displayWorkState(card);
  const tone = stopFlagged ? stopReasonTone(resolvedTheme) : stateTone(displayState, resolvedTheme, colors);
  const progress = card.progressPercent ?? 0;
  const showRing = card.progressPercent !== null && card.progressPercent > 0;
  const progressLabel = card.progressPercent !== null ? `${progress}%` : "";

  return (
    <Pressable
      style={[
        styles.craneCard,
        compact ? styles.craneCardCompact : styles.craneCardFull,
        minimal ? styles.craneCardMinimal : null,
      ]}
      onLongPress={onLongPress}
      delayLongPress={220}
    >
      <View style={styles.craneCardTop}>
        <View style={[styles.craneIdPill, { backgroundColor: tone.badgeBackground, borderColor: tone.badgeBorder }]}>
          <Text style={[styles.craneIdPillText, { color: tone.badgeText }]}>{card.craneId}</Text>
        </View>
        <CraneAlarmBadge visible={alarmEnabled} styles={styles} />
      </View>

      {minimal ? (
        <View style={[styles.craneCardBody, styles.craneCardBodyMinimal]}>
          <View style={[styles.craneCopyBlock, styles.craneCopyBlockMinimal]}>
            <View style={styles.metricStackMinimal}>
              <View style={styles.metricRowMinimal}>
                <Text style={styles.metricLabelMinimal}>Remaining</Text>
                <Text style={styles.metricValueMinimal}>{formatMetric(card.totalRemaining)}</Text>
              </View>
              <View style={styles.metricRowMinimal}>
                <Text style={styles.metricLabelMinimal}>Discharging</Text>
                <Text style={styles.metricValueMinimal}>{formatMetric(card.dischargeRemaining)}</Text>
              </View>
              <View style={styles.metricRowMinimal}>
                <Text style={styles.metricLabelMinimal}>Loading</Text>
                <Text style={styles.metricValueMinimal}>{formatMetric(card.loadRemaining)}</Text>
              </View>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.craneCardBody}>
          <View style={styles.craneCopyBlock}>
            <Text style={styles.vesselName} numberOfLines={compact ? 2 : 1}>
              {card.vesselLabel}
            </Text>
            <Text style={styles.stateText}>{workStateLabel(displayState)}</Text>
            <Text style={styles.stateHint}>{workStateHint(displayState, card.crewAssigned)}</Text>
            {card.queueLabel ? <Text style={styles.queueText}>{card.queueLabel}</Text> : null}
            <View style={styles.metricStack}>
              <Text style={styles.metricStrong}>Remaining: {formatMetric(card.totalRemaining)}</Text>
              <Text style={styles.metricText}>Discharging: {formatMetric(card.dischargeRemaining)}</Text>
              <Text style={styles.metricText}>Loading: {formatMetric(card.loadRemaining)}</Text>
            </View>
          </View>

          {showRing ? (
            <View style={styles.progressCluster}>
              <ProgressRing size={60} progress={progress} color={tone.meter} trackColor={tone.track} />
              <Text style={styles.progressClusterValue}>{progressLabel}</Text>
            </View>
          ) : (
            <View style={styles.progressPlaceholder}>
              <Text style={styles.progressPlaceholderText}>{card.crewAssigned ? "Crew Ready" : "Crew Pending"}</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.cardFooter}>
        <Text style={styles.footerCopy}>Updated {formatUpdatedAt(card.seenAt)}</Text>
        {card.berthLabel ? <Text style={[styles.footerCopy, { color: tone.meter }]}>{card.berthLabel} berth</Text> : null}
      </View>
    </Pressable>
  );
}

function TerminalMapIllustration({
  cards,
  colors,
  recentCompletionCraneIds,
  resolvedTheme,
  stopReasonByGcNo,
  vesselLabel,
  styles,
}: {
  cards: CraneCardModel[];
  colors: ReturnType<typeof useAppPreferences>["colors"];
  recentCompletionCraneIds: Set<string>;
  resolvedTheme: "light" | "dark";
  stopReasonByGcNo: Map<number, string>;
  vesselLabel: string;
  styles: ReturnType<typeof createStyles>;
}) {
  const berthCards = MAP_GC_NUMBERS.map((gcNo) => cards.find((card) => card.gcNo === gcNo) || null);
  const cardToneOffsets = buildMapCardToneOffsets(berthCards);
  const neutralPalette = createOverviewPalette("idle", resolvedTheme, colors);
  const stopReasonPalette = createStopReasonPalette(resolvedTheme);
  const hasMapStopReason = (card: CraneCardModel | null): boolean =>
    Boolean(card && card.gcNo !== null && hasText(stopReasonByGcNo.get(card.gcNo)));
  const paletteForCard = (card: CraneCardModel | null): OverviewPalette => {
    if (!card) {
      return createOverviewPalette("idle", resolvedTheme, colors);
    }
    if (recentCompletionCraneIds.has(card.craneId)) {
      return createRecentCompletionPalette(resolvedTheme);
    }
    return createOverviewPalette(
      displayWorkState(card),
      resolvedTheme,
      colors,
      cardToneOffsets.get(card.cardKey) ?? 0,
    );
  };
  const cranePaletteForCard = (card: CraneCardModel | null): OverviewPalette => {
    if (hasMapStopReason(card)) {
      return stopReasonPalette;
    }
    return paletteForCard(card);
  };
  const yardStacks = berthCards.flatMap((card, index) => {
    const palette = paletteForCard(card);
    const middleSlotColor =
      card && (recentCompletionCraneIds.has(card.craneId) || displayWorkState(card) === "active")
        ? palette.soft
        : neutralPalette.soft;
    return [
      {
        primary: palette.solid,
        secondary: middleSlotColor,
        tertiary: index % 2 === 0 ? palette.solid : palette.soft,
      },
      {
        primary: index % 3 === 0 ? palette.solid : palette.soft,
        secondary: middleSlotColor,
        tertiary: palette.solid,
      },
    ];
  });
  const shipCards = berthCards.filter((card): card is CraneCardModel => card !== null).slice(0, 6);
  const neutralSlot = resolvedTheme === "dark" ? "#555f6a" : "#d5d9df";
  const terminalFill = resolvedTheme === "dark" ? "#2a323b" : "#eef1f5";
  const berthFill = resolvedTheme === "dark" ? "#3a4450" : "#dde2ea";
  const waterLabelColor = resolvedTheme === "dark" ? "#d7e5f1" : "#1f2d3b";

  return (
    <View style={styles.mapWrap}>
      <View style={styles.mapIllustrationShell}>
        <Svg width="100%" height={252} viewBox="0 0 360 252">
          <Defs>
            <LinearGradient id="terminal-bg" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={resolvedTheme === "dark" ? "#2c343d" : "#f8f9fb"} />
              <Stop offset="1" stopColor={resolvedTheme === "dark" ? "#232a31" : "#edf1f6"} />
            </LinearGradient>
            <LinearGradient id="water-bg" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={resolvedTheme === "dark" ? "#6a98b9" : "#d9eefb"} />
              <Stop offset="1" stopColor={resolvedTheme === "dark" ? "#577e9a" : "#c8e2f5"} />
            </LinearGradient>
          </Defs>

          <Rect x={0} y={0} width={360} height={252} fill="url(#terminal-bg)" />
          <Path
            d="M14 30 H346 V118 L330 136 H30 L14 118 Z"
            fill={terminalFill}
            stroke={resolvedTheme === "dark" ? "#5d6874" : "#bcc4cf"}
            strokeWidth={2}
          />

          <Rect
            x={22}
            y={20}
            width={316}
            height={38}
            rx={7}
            fill={resolvedTheme === "dark" ? "#303944" : "#f4f6f9"}
            stroke={resolvedTheme === "dark" ? "#5b6672" : "#c3cad4"}
            strokeWidth={1.4}
          />
          <Rect
            x={22}
            y={65}
            width={316}
            height={38}
            rx={7}
            fill={resolvedTheme === "dark" ? "#303944" : "#f4f6f9"}
            stroke={resolvedTheme === "dark" ? "#5b6672" : "#c3cad4"}
            strokeWidth={1.4}
          />

          {yardStacks.slice(0, 20).map((stack, index) => {
            const column = index % 10;
            const row = Math.floor(index / 10);
            const x = 28 + column * 31;
            const y = 27 + row * 45;
            return (
              <G key={`yard-${index}`}>
                <Rect
                  x={x}
                  y={y}
                  width={22}
                  height={18}
                  rx={2}
                  fill={resolvedTheme === "dark" ? "#515d69" : "#d7dce3"}
                  stroke={resolvedTheme === "dark" ? "#7b8692" : "#9097a3"}
                  strokeWidth={0.8}
                />
                <Rect x={x + 1.5} y={y + 1.5} width={19} height={4} rx={1.2} fill={stack.primary || neutralSlot} />
                <Rect x={x + 1.5} y={y + 6.8} width={19} height={4} rx={1.2} fill={stack.secondary || neutralSlot} />
                <Rect x={x + 1.5} y={y + 12.1} width={19} height={4} rx={1.2} fill={stack.tertiary || neutralSlot} />
              </G>
            );
          })}

          <Rect x={0} y={129} width={360} height={24} fill={berthFill} />
          <Path d="M0 147 H360" stroke={resolvedTheme === "dark" ? "#8791a0" : "#c4cad4"} strokeWidth={2} />
          <Path d="M0 154 H360" stroke={resolvedTheme === "dark" ? "#a1a8b3" : "#d9dde4"} strokeWidth={1.5} />

          {berthCards.map((card, index) => {
            const palette = cranePaletteForCard(card);
            const x = 24 + index * 31;
            return (
              <G key={`crane-${MAP_GC_NUMBERS[index]}`} transform={`translate(${x} 102)`}>
                <Rect x={0} y={5} width={5} height={57} rx={2} fill={palette.solid} stroke={palette.stroke} strokeWidth={1.3} />
                <Rect x={18} y={5} width={4} height={57} rx={2} fill={palette.soft} stroke={palette.stroke} strokeWidth={1.3} />
                <Path d="M2 5 H20 V62 H2 Z" fill="none" stroke={palette.stroke} strokeWidth={1.3} />
                <Path d="M2 5 L20 23 M2 23 L20 41 M2 41 L20 62" fill="none" stroke={palette.stroke} strokeWidth={1.1} />
                <Rect x={-4} y={17} width={30} height={12} rx={3} fill={palette.solid} stroke={palette.stroke} strokeWidth={1.3} />
                <Rect x={1} y={-14} width={4} height={19} rx={2} fill={palette.solid} stroke={palette.stroke} strokeWidth={1.2} />
                <Path
                  d="M3 -14 L15 -24 H22 V-14"
                  fill="none"
                  stroke={palette.stroke}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </G>
            );
          })}

          <Rect x={0} y={155} width={360} height={97} fill="url(#water-bg)" />
          <Path
            d="M94 202 C104 176 127 166 163 166 H264 C291 166 311 175 322 190 V212 C310 222 289 228 262 228 H163 C129 228 106 220 94 202 Z"
            fill={resolvedTheme === "dark" ? "#cfd6df" : "#e6e9ef"}
            stroke={resolvedTheme === "dark" ? "#161d26" : "#22272d"}
            strokeWidth={1.8}
          />
          <Path
            d="M282 166 H296 V183 H303 V217 H296 V228 H282 Z"
            fill={resolvedTheme === "dark" ? "#e8ecf1" : "#f4f6f8"}
            stroke={resolvedTheme === "dark" ? "#161d26" : "#22272d"}
            strokeWidth={1.8}
          />

          {shipCards.map((card, index) => {
            const palette = paletteForCard(card);
            const row = index % 2;
            const column = Math.floor(index / 2);
            const x = 132 + column * 22;
            const y = 177 + row * 15;
            return (
              <Rect
                key={`ship-${card.craneId}`}
                x={x}
                y={y}
                width={18}
                height={12}
                rx={1.7}
                fill={row === 0 ? palette.solid : palette.soft}
                stroke={palette.stroke}
                strokeWidth={0.8}
              />
            );
          })}
          {Array.from({ length: 4 }).map((_, index) => (
            <Rect
              key={`ship-neutral-${index}`}
              x={220 + index * 19}
              y={177 + (index % 2) * 15}
              width={16}
              height={12}
              rx={1.7}
              fill={neutralSlot}
              stroke={resolvedTheme === "dark" ? "#4b5662" : "#a5acb7"}
              strokeWidth={0.8}
            />
          ))}
        </Svg>
      </View>
      <Text style={[styles.mapCaption, { color: waterLabelColor }]} numberOfLines={1}>
        {vesselLabel}
      </Text>
    </View>
  );
}

function createStyles(
  colors: ReturnType<typeof useAppPreferences>["colors"],
  resolvedTheme: "light" | "dark",
) {
  const shadowOpacity = resolvedTheme === "dark" ? 0.22 : 0.1;
  const sectionShadow = {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity,
    shadowRadius: 18,
    elevation: 6,
  };

  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: resolvedTheme === "dark" ? "#151b22" : "#eceef2",
    },
    content: {
      paddingHorizontal: 16,
      paddingBottom: 34,
      gap: 16,
    },
    headerSection: {
      gap: 12,
    },
    eyebrow: {
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 1.2,
      textTransform: "uppercase",
      color: colors.secondaryText,
    },
    headerTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 12,
    },
    heroTitle: {
      fontSize: 28,
      lineHeight: 34,
      fontWeight: "800",
      color: colors.primaryText,
      flexShrink: 1,
    },
    segmentedControl: {
      flexDirection: "row",
      alignItems: "center",
      padding: 4,
      borderRadius: 18,
      backgroundColor: resolvedTheme === "dark" ? "#2a3139" : "#e7e7ea",
      borderWidth: 1,
      borderColor: colors.border,
      gap: 4,
    },
    segmentButton: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 14,
    },
    segmentButtonActive: {
      backgroundColor: colors.surfaceBackground,
      ...sectionShadow,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 8,
      elevation: 3,
    },
    segmentText: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.secondaryText,
    },
    segmentTextActive: {
      color: colors.primaryText,
    },
    updatedRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 18,
      paddingVertical: 14,
      borderRadius: 24,
      backgroundColor: colors.surfaceBackground,
      borderWidth: 1,
      borderColor: colors.border,
      ...sectionShadow,
    },
    updatedCopy: {
      gap: 2,
    },
    updatedLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.secondaryText,
    },
    updatedValue: {
      fontSize: 24,
      lineHeight: 28,
      fontWeight: "700",
      color: colors.primaryText,
    },
    refreshButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: resolvedTheme === "dark" ? "#263240" : "#edf5ff",
      borderWidth: 1,
      borderColor: resolvedTheme === "dark" ? "#3c536b" : "#caddf5",
    },
    mapCard: {
      padding: 14,
      borderRadius: 28,
      backgroundColor: colors.surfaceBackground,
      borderWidth: 1,
      borderColor: colors.border,
      ...sectionShadow,
    },
    mapWrap: {
      gap: 12,
    },
    mapIllustrationShell: {
      borderRadius: 22,
      overflow: "hidden",
      backgroundColor: resolvedTheme === "dark" ? "#242c35" : "#f3f5f8",
      borderWidth: 1,
      borderColor: colors.border,
    },
    mapCaption: {
      textAlign: "center",
      fontSize: 18,
      fontWeight: "800",
      letterSpacing: 0.2,
      color: colors.primaryText,
    },
    summaryCard: {
      flexDirection: "row",
      alignItems: "stretch",
      padding: 20,
      borderRadius: 28,
      backgroundColor: colors.surfaceBackground,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 18,
      ...sectionShadow,
    },
    summaryCardStacked: {
      flexDirection: "column",
    },
    summaryColumn: {
      flex: 1,
      gap: 12,
    },
    summaryTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    summaryTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.primaryText,
    },
    summaryChipWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    summaryDivider: {
      width: 1,
      backgroundColor: colors.border,
    },
    summaryDividerHorizontal: {
      width: "100%",
      height: 1,
    },
    progressHeadline: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.primaryText,
    },
    statusChip: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 14,
      borderWidth: 1,
    },
    statusChipText: {
      fontSize: 15,
      fontWeight: "700",
    },
    meterBlock: {
      gap: 6,
    },
    meterCopyRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    meterLabel: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.primaryText,
    },
    meterValue: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.secondaryText,
    },
    meterTrack: {
      height: 14,
      borderRadius: 999,
      overflow: "hidden",
    },
    meterFill: {
      height: "100%",
      borderRadius: 999,
    },
    errorCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: resolvedTheme === "dark" ? "rgba(255,122,122,0.12)" : "#fff0ee",
      borderWidth: 1,
      borderColor: resolvedTheme === "dark" ? "rgba(255,122,122,0.24)" : "#f6b4ac",
    },
    errorText: {
      flex: 1,
      fontSize: 14,
      color: colors.primaryText,
    },
    cardsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 14,
    },
    craneCard: {
      padding: 18,
      borderRadius: 24,
      backgroundColor: colors.surfaceBackground,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 14,
      ...sectionShadow,
    },
    craneCardCompact: {
      width: "48%",
    },
    craneCardFull: {
      width: "100%",
    },
    craneCardMinimal: {
      padding: 14,
      gap: 10,
      borderRadius: 20,
    },
    craneCardTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    craneAlarmBadge: {
      width: 26,
      height: 26,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: resolvedTheme === "dark" ? "#203146" : "#2e90ed",
      borderWidth: 1,
      borderColor: resolvedTheme === "dark" ? "#4e7baa" : "#8abcf3",
    },
    craneIdPill: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 13,
      borderWidth: 1,
    },
    craneIdPillText: {
      fontSize: 16,
      fontWeight: "800",
    },
    craneCardBody: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 14,
    },
    craneCardBodyMinimal: {
      alignItems: "center",
      gap: 10,
    },
    craneCopyBlock: {
      flex: 1,
      gap: 6,
    },
    craneCopyBlockMinimal: {
      gap: 0,
    },
    vesselName: {
      fontSize: 18,
      lineHeight: 23,
      fontWeight: "800",
      color: colors.primaryText,
    },
    stateText: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.secondaryText,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    stateHint: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.secondaryText,
    },
    queueText: {
      fontSize: 12,
      lineHeight: 17,
      color: colors.secondaryText,
    },
    metricStack: {
      marginTop: 4,
      gap: 4,
    },
    metricStackMinimal: {
      gap: 8,
    },
    metricRowMinimal: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    metricLabelMinimal: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.secondaryText,
    },
    metricValueMinimal: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.primaryText,
    },
    metricStrong: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.primaryText,
    },
    metricText: {
      fontSize: 15,
      lineHeight: 20,
      color: colors.primaryText,
    },
    progressCluster: {
      alignItems: "center",
      justifyContent: "center",
      minWidth: 68,
      gap: 6,
    },
    progressClusterValue: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.primaryText,
    },
    progressPlaceholder: {
      minWidth: 78,
      paddingHorizontal: 10,
      paddingVertical: 12,
      borderRadius: 16,
      backgroundColor: resolvedTheme === "dark" ? "#2d353f" : "#f1f3f6",
      alignItems: "center",
      justifyContent: "center",
    },
    progressPlaceholderText: {
      fontSize: 12,
      lineHeight: 16,
      textAlign: "center",
      fontWeight: "700",
      color: colors.secondaryText,
    },
    cardFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    footerCopy: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.secondaryText,
    },
    progressAlertModalRoot: {
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: 18,
      backgroundColor: "rgba(5, 8, 14, 0.26)",
    },
    progressAlertSheet: {
      borderRadius: 26,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceBackground,
      padding: 20,
      gap: 16,
      ...sectionShadow,
    },
    progressAlertHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
    },
    progressAlertHeaderCopy: {
      flex: 1,
      gap: 4,
    },
    progressAlertTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: colors.primaryText,
    },
    progressAlertSubtitle: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.secondaryText,
    },
    progressAlertClose: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.badgeBackground,
    },
    progressAlertValueCard: {
      position: "relative",
      overflow: "hidden",
      borderRadius: 18,
      paddingVertical: 12,
      paddingHorizontal: 16,
      alignItems: "center",
      gap: 4,
      backgroundColor: resolvedTheme === "dark" ? "#202a35" : "#f4f8fc",
      borderWidth: 1,
      borderColor: colors.border,
    },
    progressAlertValueFill: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      backgroundColor: resolvedTheme === "dark" ? "#27517d" : "#9fd0ff",
    },
    progressAlertValueFillComplete: {
      right: 0,
    },
    progressAlertValueSheen: {
      position: "absolute",
      inset: 0,
      backgroundColor: resolvedTheme === "dark" ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.22)",
    },
    progressAlertValue: {
      zIndex: 1,
      fontSize: 30,
      fontWeight: "900",
      color: colors.primaryText,
    },
    progressAlertHint: {
      zIndex: 1,
      fontSize: 12,
      lineHeight: 16,
      textAlign: "center",
      color: colors.secondaryText,
    },
    progressAlertFineHint: {
      zIndex: 1,
      fontSize: 11,
      lineHeight: 15,
      textAlign: "center",
      color: colors.secondaryText,
    },
    progressAlertActionRow: {
      flexDirection: "row",
      gap: 10,
    },
    progressAlertActionButton: {
      flex: 1,
      minHeight: 46,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 16,
    },
    progressAlertDisableButton: {
      backgroundColor: colors.elevatedBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    progressAlertSaveButton: {
      backgroundColor: colors.badgeBackground,
    },
    progressAlertDisableText: {
      fontSize: 15,
      fontWeight: "800",
      color: colors.primaryText,
    },
    progressAlertSaveText: {
      fontSize: 15,
      fontWeight: "800",
      color: "#ffffff",
    },
    progressAlertActionDisabled: {
      opacity: 0.6,
    },
    emptyCard: {
      padding: 24,
      borderRadius: 24,
      backgroundColor: colors.surfaceBackground,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 8,
      ...sectionShadow,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.primaryText,
    },
    emptyBody: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.secondaryText,
    },
  });
}
