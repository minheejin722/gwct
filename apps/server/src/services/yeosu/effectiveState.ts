import type { WeatherNoticeSnapshot } from "@gwct/shared";
import type { WeatherNormalizedState } from "../monitorConfig/store.js";

type EffectiveSemanticState = "NORMAL" | "SUSPENDED";

function toEffectiveSemanticState(state: WeatherNormalizedState | null | undefined): EffectiveSemanticState {
  return state === "all" || state === "partial" ? "SUSPENDED" : "NORMAL";
}

function seenAtMillis(snapshot: WeatherNoticeSnapshot | null): number {
  if (!snapshot) {
    return Number.NEGATIVE_INFINITY;
  }
  const parsed = Date.parse(snapshot.seenAt);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function uniqKeywords(...groups: Array<string[] | null | undefined>): string[] {
  return Array.from(
    new Set(
      groups
        .flatMap((group) => group || [])
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function applySemanticFallback(
  snapshot: WeatherNoticeSnapshot | null,
  fallbackState: WeatherNormalizedState | null | undefined,
): WeatherNoticeSnapshot | null {
  if (!snapshot || snapshot.semanticState !== "UNKNOWN") {
    return snapshot;
  }

  const semanticState = toEffectiveSemanticState(fallbackState);
  return {
    ...snapshot,
    suspensionState: semanticState === "SUSPENDED" ? "all" : "none",
    semanticState,
    normalizedReason: snapshot.normalizedReason || `AMBIGUOUS_KEEP_PREV:${semanticState}`,
  };
}

function pickBoardEvidence(
  notice: WeatherNoticeSnapshot | null,
  news: WeatherNoticeSnapshot | null,
): WeatherNoticeSnapshot | null {
  const boardSnapshots = [notice, news].filter((item): item is WeatherNoticeSnapshot => Boolean(item));
  if (!boardSnapshots.length) {
    return null;
  }

  const suspended = boardSnapshots
    .filter((item) => item.semanticState === "SUSPENDED")
    .sort((left, right) => seenAtMillis(right) - seenAtMillis(left))[0];
  if (suspended) {
    return suspended;
  }

  const normal = boardSnapshots
    .filter((item) => item.semanticState === "NORMAL")
    .sort((left, right) => seenAtMillis(right) - seenAtMillis(left))[0];
  if (normal) {
    return normal;
  }

  return boardSnapshots.sort((left, right) => seenAtMillis(right) - seenAtMillis(left))[0] || null;
}

function mergeForecastAndBoard(
  forecast: WeatherNoticeSnapshot,
  board: WeatherNoticeSnapshot,
  overrideSemanticState: boolean,
): WeatherNoticeSnapshot {
  return {
    ...forecast,
    noticeHeadline: board.noticeHeadline || forecast.noticeHeadline,
    matchedKeywords: uniqKeywords(forecast.matchedKeywords, board.matchedKeywords),
    suspensionState: overrideSemanticState ? board.suspensionState : forecast.suspensionState,
    semanticState: overrideSemanticState ? board.semanticState : forecast.semanticState,
    normalizedReason:
      (overrideSemanticState ? board.normalizedReason : forecast.normalizedReason) ||
      board.normalizedReason ||
      forecast.normalizedReason,
    severity: overrideSemanticState ? board.severity : forecast.severity,
  };
}

export function buildEffectiveYeosuSnapshot(input: {
  forecast: WeatherNoticeSnapshot | null;
  notice: WeatherNoticeSnapshot | null;
  news: WeatherNoticeSnapshot | null;
  fallbackState?: WeatherNormalizedState | null;
}): WeatherNoticeSnapshot | null {
  const forecast = applySemanticFallback(input.forecast, input.fallbackState);
  const notice = input.notice;
  const news = input.news;
  const board = pickBoardEvidence(notice, news);

  if (!forecast) {
    return board;
  }

  if (!board) {
    return forecast;
  }

  if (forecast.semanticState === "SUSPENDED" && board.semanticState === "SUSPENDED") {
    return mergeForecastAndBoard(forecast, board, false);
  }

  if (forecast.semanticState === "UNKNOWN" && board.semanticState !== "UNKNOWN") {
    return mergeForecastAndBoard(forecast, board, true);
  }

  if (forecast.semanticState !== "SUSPENDED" && board.semanticState === "SUSPENDED") {
    return mergeForecastAndBoard(forecast, board, true);
  }

  if (forecast.semanticState === "NORMAL" && board.semanticState === "NORMAL" && !forecast.noticeHeadline) {
    return mergeForecastAndBoard(forecast, board, false);
  }

  return forecast;
}

export function buildYeosuObservedText(snapshot: WeatherNoticeSnapshot | null): string | null {
  if (!snapshot) {
    return null;
  }

  const parts = [
    snapshot.dispatchTeamDutyText ? `배선팀근무 ${snapshot.dispatchTeamDutyText}` : null,
    snapshot.standbyCallText ? `대기호출자 ${snapshot.standbyCallText}` : null,
    snapshot.noticeHeadline ? `보조공지 ${snapshot.noticeHeadline}` : null,
  ].filter((item): item is string => Boolean(item));

  return parts.length ? parts.join(" | ") : null;
}
