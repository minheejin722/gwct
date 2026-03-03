import { load } from "cheerio";
import type { SourceId, WeatherNoticeSnapshot } from "@gwct/shared";
import { sha256 } from "../lib/hash.js";
import type { NormalizedSnapshotBundle } from "./types.js";
import {
  ysAllSuspendedPatterns,
  ysPartialSuspendedPatterns,
  ysSelectors,
} from "./selectors/ys.js";

function clean(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
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

function classifySuspension(text: string): {
  state: "none" | "partial" | "all";
  severity: "normal" | "warning" | "critical";
  keywords: string[];
} {
  const keywords: string[] = [];
  for (const pattern of ysAllSuspendedPatterns) {
    if (pattern.test(text)) {
      keywords.push(pattern.source);
    }
  }
  if (keywords.length > 0) {
    return {
      state: "all",
      severity: "critical",
      keywords,
    };
  }

  for (const pattern of ysPartialSuspendedPatterns) {
    if (pattern.test(text)) {
      keywords.push(pattern.source);
    }
  }

  if (keywords.length > 0) {
    return {
      state: "partial",
      severity: "warning",
      keywords,
    };
  }

  return {
    state: "none",
    severity: "normal",
    keywords,
  };
}

function weatherSignature(snapshot: Omit<WeatherNoticeSnapshot, "signature">): string {
  return sha256(
    JSON.stringify({
      dutyText: snapshot.dutyText,
      dispatchTeamDutyText: snapshot.dispatchTeamDutyText,
      noticeHeadline: snapshot.noticeHeadline,
      suspensionState: snapshot.suspensionState,
      severity: snapshot.severity,
    }),
  );
}

export function parseYsForecast(html: string, seenAt: string, source: SourceId): NormalizedSnapshotBundle {
  const bundle = emptyBundle();
  const $ = load(html);

  let dispatchTeamDutyText: string | null = null;
  let dutyText: string | null = null;

  $(ysSelectors.forecast.tableRows).each((_, row) => {
    const headers = $(row)
      .find(ysSelectors.forecast.headerCell)
      .map((__, h) => clean($(h).text()))
      .get();

    if (headers.some((h) => h.includes("배선팀근무"))) {
      const cells = $(row)
        .find(ysSelectors.forecast.valueCell)
        .map((__, td) => clean($(td).text()))
        .get();
      dispatchTeamDutyText = cells[cells.length - 1] || null;
    }

    if (headers.some((h) => h.includes("근무자"))) {
      const firstDuty = $(row)
        .next()
        .find("td.datatype1")
        .first()
        .text();
      dutyText = clean(firstDuty) || null;
    }
  });

  const baseText = clean(`${dispatchTeamDutyText || ""} ${dutyText || ""}`);
  const classified = classifySuspension(baseText);

  const weatherBase: Omit<WeatherNoticeSnapshot, "signature"> = {
    source,
    dutyText,
    dispatchTeamDutyText,
    noticeHeadline: null,
    suspensionState: classified.state,
    matchedKeywords: classified.keywords,
    severity: classified.severity,
    seenAt,
  };

  bundle.weather = {
    ...weatherBase,
    signature: weatherSignature(weatherBase),
  };

  if (!dispatchTeamDutyText) {
    bundle.diagnostics.push({
      parserName: "parseYsForecast",
      reason: "dispatch team duty text missing",
      diagnostics: {
        expectedHeader: "배선팀근무",
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

  const classified = classifySuspension(headline || "");

  const weatherBase: Omit<WeatherNoticeSnapshot, "signature"> = {
    source,
    dutyText: null,
    dispatchTeamDutyText: null,
    noticeHeadline: headline,
    suspensionState: classified.state,
    matchedKeywords: classified.keywords,
    severity: classified.severity,
    seenAt,
  };

  bundle.weather = {
    ...weatherBase,
    signature: weatherSignature(weatherBase),
  };

  return bundle;
}

export { classifySuspension };
