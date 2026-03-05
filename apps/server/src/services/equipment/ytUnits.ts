import type { EquipmentLoginStatus, YTSemanticState, YTUnitSnapshot } from "@gwct/shared";
import { sha256 } from "../../lib/hash.js";

const EMPTY_TEXT_MARKERS = new Set(["-", "—", "N/A", "NA"]);
const NON_DRIVER_WORDS = /^(고장|수리|예비장비|운전원교대|운전원 교대|점검|주유)$/;
const YT_NO_PATTERN = /^YT-?(\d+)$/;

function collapseWhitespace(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

export function normalizeOptionalEquipmentText(value: string | null | undefined): string | null {
  const normalized = collapseWhitespace(value);
  if (!normalized) {
    return null;
  }
  const compactUpper = normalized.replace(/\s+/g, "").toUpperCase();
  if (EMPTY_TEXT_MARKERS.has(compactUpper)) {
    return null;
  }
  return normalized;
}

export function normalizeDriverNameForEquipment(value: string | null | undefined): string | null {
  const normalized = normalizeOptionalEquipmentText(value);
  if (!normalized) {
    return null;
  }
  if (NON_DRIVER_WORDS.test(normalized)) {
    return null;
  }
  return normalized;
}

export function normalizeYtNo(equipmentId: string): string | null {
  const compact = collapseWhitespace(equipmentId).toUpperCase().replace(/\s+/g, "");
  const matched = compact.match(YT_NO_PATTERN);
  if (!matched) {
    return null;
  }
  return `YT${matched[1]}`;
}

function semanticStateFromRow(driverName: string | null, stopReason: string | null): YTSemanticState {
  if (!driverName) {
    return "logged_out";
  }
  if (stopReason) {
    return "stopped";
  }
  return "active";
}

function normalizeFingerprintPart(value: string | null): string {
  if (!value) {
    return "";
  }
  return value.replace(/\s+/g, " ").trim().toUpperCase();
}

function createFingerprint(row: Omit<YTUnitSnapshot, "fingerprint">): string {
  return sha256(
    JSON.stringify({
      ytNo: row.ytNo.toUpperCase(),
      semanticState: row.semanticState,
      stopReason: normalizeFingerprintPart(row.stopReason),
      driverName: normalizeFingerprintPart(row.driverName),
      loginTime: normalizeFingerprintPart(row.loginTime),
      hkName: normalizeFingerprintPart(row.hkName),
    }),
  );
}

function unitScore(row: Omit<YTUnitSnapshot, "fingerprint">): number {
  let score = 0;
  if (row.driverName) {
    score += 4;
  }
  if (row.loginTime) {
    score += 2;
  }
  if (row.hkName) {
    score += 1;
  }
  if (row.stopReason) {
    score += 1;
  }
  return score;
}

function semanticPriority(state: YTSemanticState): number {
  if (state === "active") {
    return 3;
  }
  if (state === "stopped") {
    return 2;
  }
  return 1;
}

function shouldReplace(existing: YTUnitSnapshot, next: YTUnitSnapshot): boolean {
  const existingScore = unitScore(existing);
  const nextScore = unitScore(next);
  if (nextScore !== existingScore) {
    return nextScore > existingScore;
  }

  const existingPriority = semanticPriority(existing.semanticState);
  const nextPriority = semanticPriority(next.semanticState);
  if (nextPriority !== existingPriority) {
    return nextPriority > existingPriority;
  }

  return next.fingerprint < existing.fingerprint;
}

function compareYtNo(a: string, b: string): number {
  const aNum = Number(a.replace(/^\D+/, ""));
  const bNum = Number(b.replace(/^\D+/, ""));
  if (Number.isFinite(aNum) && Number.isFinite(bNum) && aNum !== bNum) {
    return aNum - bNum;
  }
  return a.localeCompare(b);
}

export function buildYtUnitSnapshotFromEquipment(items: EquipmentLoginStatus[]): YTUnitSnapshot[] {
  const map = new Map<string, YTUnitSnapshot>();

  for (const item of items) {
    const ytNo = normalizeYtNo(item.equipmentId);
    if (!ytNo) {
      continue;
    }

    const driverName = normalizeDriverNameForEquipment(item.operatorName);
    const hkName = normalizeOptionalEquipmentText(item.helperName);
    const loginTime = normalizeOptionalEquipmentText(item.loginText);
    const stopReason = normalizeOptionalEquipmentText(item.stopReason);
    const semanticState = semanticStateFromRow(driverName, stopReason);

    const baseRow: Omit<YTUnitSnapshot, "fingerprint"> = {
      ytNo,
      driverName,
      loginTime,
      hkName,
      stopReason,
      semanticState,
    };

    const candidate: YTUnitSnapshot = {
      ...baseRow,
      fingerprint: createFingerprint(baseRow),
    };

    const existing = map.get(ytNo);
    if (!existing || shouldReplace(existing, candidate)) {
      map.set(ytNo, candidate);
    }
  }

  return Array.from(map.values()).sort((a, b) => compareYtNo(a.ytNo, b.ytNo));
}

export function countLoggedInYtUnits(units: YTUnitSnapshot[]): number {
  return units.filter((unit) => unit.semanticState !== "logged_out").length;
}
