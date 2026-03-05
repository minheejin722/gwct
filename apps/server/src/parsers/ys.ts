import { load } from "cheerio";
import type { SourceId, WeatherNoticeSnapshot } from "@gwct/shared";
import { sha256 } from "../lib/hash.js";
import type { NormalizedSnapshotBundle } from "./types.js";
import {
  ysNormalSignalPatterns,
  ysSelectors,
  ysSuspendSignalPatterns,
  type YsSignalPattern,
} from "./selectors/ys.js";

function clean(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

function normalizeSignalText(raw: string | null | undefined): string | null {
  const collapsed = clean(raw);
  if (!collapsed) {
    return null;
  }

  const normalized = collapsed
    .replace(/[■●•▪◆◇○◎※]/g, " ")
    .replace(/[(){}\[\]<>]/g, " ")
    .replace(/[,:;!?\"'`]/g, " ")
    .replace(/[|/\\]/g, " ")
    .replace(/\.+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  return normalized.length ? normalized : null;
}

function emptyBundle(): NormalizedSnapshotBundle {
  return {
    vessels: [],
    cranes: [],
    equipment: [],
    yt: null,
    weather: null,
    diagnostics: [],
  };
}

type SignalField = "dispatch" | "standby";

interface SignalPatternMatch {
  field: SignalField;
  label: string;
}

interface CombinedSignalClassification {
  suspensionState: "none" | "partial" | "all";
  semanticState: "NORMAL" | "SUSPENDED" | "UNKNOWN";
  severity: "normal" | "warning" | "critical";
  matchedKeywords: string[];
  normalizedReason: string | null;
}

function collectPatternMatches(
  field: SignalField,
  normalizedText: string | null,
  patterns: YsSignalPattern[],
): SignalPatternMatch[] {
  if (!normalizedText) {
    return [];
  }

  const matches: SignalPatternMatch[] = [];
  for (const item of patterns) {
    if (item.pattern.test(normalizedText)) {
      matches.push({ field, label: item.label });
    }
  }
  return matches;
}

function formatNormalizedReason(
  semanticState: "NORMAL" | "SUSPENDED" | "UNKNOWN",
  keywords: string[],
  dispatchNormalized: string | null,
  standbyNormalized: string | null,
): string | null {
  const dispatch = dispatchNormalized || "-";
  const standby = standbyNormalized || "-";

  if (semanticState === "SUSPENDED") {
    return `SUSPENDED:${keywords.join(", ")} | dispatch=${dispatch} | standby=${standby}`;
  }

  if (semanticState === "NORMAL") {
    return `NORMAL:${keywords.join(", ")} | dispatch=${dispatch} | standby=${standby}`;
  }

  if (dispatch === "-" && standby === "-") {
    return null;
  }

  return `AMBIGUOUS | dispatch=${dispatch} | standby=${standby}`;
}

function classifyCombinedSignal(
  dispatchNormalized: string | null,
  standbyNormalized: string | null,
): CombinedSignalClassification {
  const suspendMatches = [
    ...collectPatternMatches("dispatch", dispatchNormalized, ysSuspendSignalPatterns),
    ...collectPatternMatches("standby", standbyNormalized, ysSuspendSignalPatterns),
  ];

  if (suspendMatches.length > 0) {
    const matchedKeywords = suspendMatches.map((item) => `${item.field}:${item.label}`);
    return {
      suspensionState: "all",
      semanticState: "SUSPENDED",
      severity: "critical",
      matchedKeywords,
      normalizedReason: formatNormalizedReason(
        "SUSPENDED",
        matchedKeywords,
        dispatchNormalized,
        standbyNormalized,
      ),
    };
  }

  const normalMatches = [
    ...collectPatternMatches("dispatch", dispatchNormalized, ysNormalSignalPatterns),
    ...collectPatternMatches("standby", standbyNormalized, ysNormalSignalPatterns),
  ];

  if (normalMatches.length > 0) {
    const matchedKeywords = normalMatches.map((item) => `${item.field}:${item.label}`);
    return {
      suspensionState: "none",
      semanticState: "NORMAL",
      severity: "normal",
      matchedKeywords,
      normalizedReason: formatNormalizedReason(
        "NORMAL",
        matchedKeywords,
        dispatchNormalized,
        standbyNormalized,
      ),
    };
  }

  return {
    suspensionState: "none",
    semanticState: "UNKNOWN",
    severity: "warning",
    matchedKeywords: [],
    normalizedReason: formatNormalizedReason("UNKNOWN", [], dispatchNormalized, standbyNormalized),
  };
}

function weatherSignature(snapshot: Omit<WeatherNoticeSnapshot, "signature">): string {
  return sha256(
    JSON.stringify({
      dutyText: snapshot.dutyText,
      dispatchTeamDutyText: snapshot.dispatchTeamDutyText,
      standbyCallText: snapshot.standbyCallText,
      noticeHeadline: snapshot.noticeHeadline,
      suspensionState: snapshot.suspensionState,
      semanticState: snapshot.semanticState,
      normalizedReason: snapshot.normalizedReason,
      severity: snapshot.severity,
    }),
  );
}

function findRowValueByHeader(
  $: ReturnType<typeof load>,
  row: any,
  headerKeyword: string,
): string | null {
  let value: string | null = null;

  $(row)
    .find(ysSelectors.forecast.headerCell)
    .each((_, cell) => {
      const header = clean($(cell).text());
      if (!header.includes(headerKeyword)) {
        return;
      }
      const nextValue = clean($(cell).nextAll(ysSelectors.forecast.valueCell).first().text());
      if (nextValue) {
        value = nextValue;
      }
    });

  return value;
}

function pickStandbyFallback($: ReturnType<typeof load>): string | null {
  const candidates = $(ysSelectors.forecast.valueCell)
    .map((_, cell) => clean($(cell).text()))
    .get();

  return (
    candidates.find((text) => /대기호출자|1\s*대기|2\s*대기|O\.?\s*K|휴가/i.test(text)) ||
    null
  );
}

export function parseYsForecast(html: string, seenAt: string, source: SourceId): NormalizedSnapshotBundle {
  const bundle = emptyBundle();
  const $ = load(html);

  let dispatchTeamDutyText: string | null = null;
  let standbyCallText: string | null = null;
  let legacyDutyText: string | null = null;

  $(ysSelectors.forecast.tableRows).each((_, row) => {
    if (!dispatchTeamDutyText) {
      dispatchTeamDutyText = findRowValueByHeader($, row, "배선팀근무") || dispatchTeamDutyText;
    }

    if (!standbyCallText) {
      standbyCallText = findRowValueByHeader($, row, "대기호출자") || standbyCallText;
    }

    const headers = $(row)
      .find(ysSelectors.forecast.headerCell)
      .map((__, h) => clean($(h).text()))
      .get();

    if (!legacyDutyText && headers.some((h) => h.includes("근무자"))) {
      const firstDuty = clean(
        $(row)
          .next()
          .find(ysSelectors.forecast.valueCell)
          .first()
          .text(),
      );
      legacyDutyText = firstDuty || null;
    }
  });

  if (!standbyCallText) {
    standbyCallText = pickStandbyFallback($);
  }

  const dispatchNormalized = normalizeSignalText(dispatchTeamDutyText);
  const standbyNormalized = normalizeSignalText(standbyCallText);
  const classified = classifyCombinedSignal(dispatchNormalized, standbyNormalized);

  const weatherBase: Omit<WeatherNoticeSnapshot, "signature"> = {
    source,
    // `dutyText` column is reused for standby call text persistence to avoid schema migration.
    dutyText: standbyCallText || legacyDutyText || null,
    dispatchTeamDutyText,
    standbyCallText,
    noticeHeadline: null,
    suspensionState: classified.suspensionState,
    semanticState: classified.semanticState,
    matchedKeywords: classified.matchedKeywords,
    normalizedReason: classified.normalizedReason,
    severity: classified.severity,
    seenAt,
  };

  bundle.weather = {
    ...weatherBase,
    signature: weatherSignature(weatherBase),
  };

  if (!dispatchTeamDutyText || !standbyCallText) {
    bundle.diagnostics.push({
      parserName: "parseYsForecast",
      reason: "forecast signal text missing",
      diagnostics: {
        dispatchTeamFound: Boolean(dispatchTeamDutyText),
        standbyCallFound: Boolean(standbyCallText),
      },
    });
  }

  return bundle;
}

export function parseYsNotice(html: string, seenAt: string, source: SourceId): NormalizedSnapshotBundle {
  const bundle = emptyBundle();
  const $ = load(html);

  let headline: string | null = null;

  $(ysSelectors.notice.rows).each((_, row) => {
    const text = clean($(row).text());
    if (!/^\d+\s/.test(text)) {
      return;
    }

    const cells = $(row)
      .find("td")
      .map((__, td) => clean($(td).text()))
      .get();

    if (cells.length >= 2) {
      headline = cells[1] || null;
      return false;
    }
    return;
  });

  const classified = classifyCombinedSignal(normalizeSignalText(headline), null);

  const weatherBase: Omit<WeatherNoticeSnapshot, "signature"> = {
    source,
    dutyText: null,
    dispatchTeamDutyText: null,
    standbyCallText: null,
    noticeHeadline: headline,
    suspensionState: classified.suspensionState,
    semanticState: classified.semanticState,
    matchedKeywords: classified.matchedKeywords,
    normalizedReason: classified.normalizedReason,
    severity: classified.severity,
    seenAt,
  };

  bundle.weather = {
    ...weatherBase,
    signature: weatherSignature(weatherBase),
  };

  return bundle;
}

export { classifyCombinedSignal, normalizeSignalText };
