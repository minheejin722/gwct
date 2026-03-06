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

const MAX_ACTIONABLE_BOARD_AGE_DAYS = 2;
const TOP_BOARD_ROWS_TO_SCAN = 12;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

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

type SignalField = "dispatch" | "standby" | "board";

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

interface BoardRowCandidate {
  headline: string;
  postedDate: string | null;
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
  boardNormalized: string | null,
): string | null {
  const parts = [
    `dispatch=${dispatchNormalized || "-"}`,
    `standby=${standbyNormalized || "-"}`,
    `board=${boardNormalized || "-"}`,
  ];

  if (semanticState === "SUSPENDED" || semanticState === "NORMAL") {
    return `${semanticState}:${keywords.join(", ")} | ${parts.join(" | ")}`;
  }

  if (dispatchNormalized === null && standbyNormalized === null && boardNormalized === null) {
    return null;
  }

  return `AMBIGUOUS | ${parts.join(" | ")}`;
}

function classifySignal(
  input: {
    dispatchNormalized?: string | null;
    standbyNormalized?: string | null;
    boardNormalized?: string | null;
  },
): CombinedSignalClassification {
  const dispatchNormalized = input.dispatchNormalized ?? null;
  const standbyNormalized = input.standbyNormalized ?? null;
  const boardNormalized = input.boardNormalized ?? null;

  const suspendMatches = [
    ...collectPatternMatches("dispatch", dispatchNormalized, ysSuspendSignalPatterns),
    ...collectPatternMatches("standby", standbyNormalized, ysSuspendSignalPatterns),
    ...collectPatternMatches("board", boardNormalized, ysSuspendSignalPatterns),
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
        boardNormalized,
      ),
    };
  }

  const normalMatches = [
    ...collectPatternMatches("dispatch", dispatchNormalized, ysNormalSignalPatterns),
    ...collectPatternMatches("standby", standbyNormalized, ysNormalSignalPatterns),
    ...collectPatternMatches("board", boardNormalized, ysNormalSignalPatterns),
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
        boardNormalized,
      ),
    };
  }

  return {
    suspensionState: "none",
    semanticState: "UNKNOWN",
    severity: "warning",
    matchedKeywords: [],
    normalizedReason: formatNormalizedReason("UNKNOWN", [], dispatchNormalized, standbyNormalized, boardNormalized),
  };
}

function classifyCombinedSignal(
  dispatchNormalized: string | null,
  standbyNormalized: string | null,
): CombinedSignalClassification {
  return classifySignal({ dispatchNormalized, standbyNormalized });
}

function classifyBoardSignal(boardNormalized: string | null): CombinedSignalClassification {
  return classifySignal({ boardNormalized });
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

function kstDayIndexFromIso(isoString: string): number | null {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return Math.floor((date.getTime() + KST_OFFSET_MS) / 86400000);
}

function boardDayIndex(rawDate: string | null): number | null {
  if (!rawDate) {
    return null;
  }
  const matched = rawDate.match(/(\d{4})[./-](\d{2})[./-](\d{2})/);
  if (!matched) {
    return null;
  }
  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function isActionableBoardRow(postedDate: string | null, seenAt: string): boolean {
  const rowDay = boardDayIndex(postedDate);
  const seenDay = kstDayIndexFromIso(seenAt);
  if (rowDay === null || seenDay === null) {
    return false;
  }
  const deltaDays = seenDay - rowDay;
  return deltaDays >= 0 && deltaDays <= MAX_ACTIONABLE_BOARD_AGE_DAYS;
}

function extractBoardRows(html: string): BoardRowCandidate[] {
  const $ = load(html);
  return $(ysSelectors.board.rows)
    .map((_, row) => {
      const cells = $(row)
        .find(ysSelectors.board.cells)
        .map((__, td) => clean($(td).text()))
        .get()
        .filter(Boolean);

      if (cells.length < 2) {
        return null;
      }

      const numberCell = cells[0] || null;
      const headline = cells[1] || null;
      const postedDate = cells.length >= 4 ? cells[3] : null;

      if (!headline || headline === "제목" || numberCell === "번호") {
        return null;
      }

      if (!numberCell) {
        return null;
      }

      if (numberCell !== "공지" && !/^\d+$/.test(numberCell)) {
        return null;
      }

      return {
        headline,
        postedDate,
      } satisfies BoardRowCandidate;
    })
    .get()
    .filter((item): item is BoardRowCandidate => Boolean(item))
    .slice(0, TOP_BOARD_ROWS_TO_SCAN);
}

function selectBoardEvidence(
  rows: BoardRowCandidate[],
  seenAt: string,
): {
  headline: string | null;
  classification: CombinedSignalClassification;
} {
  if (!rows.length) {
    return {
      headline: null,
      classification: classifyBoardSignal(null),
    };
  }

  const actionableRows = rows.filter((row) => isActionableBoardRow(row.postedDate, seenAt));
  const candidates = actionableRows;

  for (const row of candidates) {
    const classification = classifyBoardSignal(normalizeSignalText(row.headline));
    if (classification.semanticState === "SUSPENDED") {
      return {
        headline: row.headline,
        classification,
      };
    }
  }

  for (const row of candidates) {
    const classification = classifyBoardSignal(normalizeSignalText(row.headline));
    if (classification.semanticState === "NORMAL") {
      return {
        headline: row.headline,
        classification,
      };
    }
  }

  const fallback = rows[0];
  return {
    headline: fallback?.headline || null,
    classification: classifyBoardSignal(null),
  };
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

    if (!legacyDutyText && headers.some((header) => header.includes("근무자"))) {
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
    dutyText: legacyDutyText,
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

function parseYsBoardList(html: string, seenAt: string, source: SourceId): NormalizedSnapshotBundle {
  const bundle = emptyBundle();
  const rows = extractBoardRows(html);
  const selected = selectBoardEvidence(rows, seenAt);

  const weatherBase: Omit<WeatherNoticeSnapshot, "signature"> = {
    source,
    dutyText: null,
    dispatchTeamDutyText: null,
    standbyCallText: null,
    noticeHeadline: selected.headline,
    suspensionState: selected.classification.suspensionState,
    semanticState: selected.classification.semanticState,
    matchedKeywords: selected.classification.matchedKeywords,
    normalizedReason: selected.classification.normalizedReason,
    severity: selected.classification.severity,
    seenAt,
  };

  bundle.weather = {
    ...weatherBase,
    signature: weatherSignature(weatherBase),
  };

  if (!rows.length) {
    bundle.diagnostics.push({
      parserName: "parseYsBoardList",
      reason: "board headline rows missing",
      diagnostics: {
        source,
      },
    });
  }

  return bundle;
}

export function parseYsNotice(html: string, seenAt: string, source: SourceId): NormalizedSnapshotBundle {
  return parseYsBoardList(html, seenAt, source);
}

export function parseYsNews(html: string, seenAt: string, source: SourceId): NormalizedSnapshotBundle {
  return parseYsBoardList(html, seenAt, source);
}

export { classifyCombinedSignal, normalizeSignalText };
