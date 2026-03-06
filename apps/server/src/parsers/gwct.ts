import { load } from "cheerio";
import type {
  CraneStatus,
  EquipmentLoginStatus,
  SourceId,
  VesselScheduleItem,
  YTCountSnapshot,
} from "@gwct/shared";
import { formatKst, parseSeoulDate } from "../lib/time.js";
import { sha256 } from "../lib/hash.js";
import type { NormalizedSnapshotBundle, ParserDiagnostics } from "./types.js";
import { gwctSelectors } from "./selectors/gwct.js";

const KOREAN_TO_FIELD: Record<string, keyof VesselScheduleItem | "ignore"> = {
  선박명: "vesselName",
  모선항차: "terminalVoyage",
  터미널항차: "terminalVoyage",
  선석: "berth",
  선사: "shippingLine",
  항로: "route",
  입항일시: "eta",
  입항일시시: "eta",
  입항일시_: "eta",
  "입항 일시": "eta",
  출항일시: "etd",
  "출항 일시": "etd",
  작업시작일시: "workStartAt",
  "작업 시작일시": "workStartAt",
  작업완료일시: "workEndAt",
  "작업 완료일시": "workEndAt",
  반입마감시간: "importCutoffAt",
  "반입 마감일시": "importCutoffAt",
  status: "status",
};

function clean(text: string | undefined | null): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

const EMPTY_PLACEHOLDER_VALUES = new Set(["-", "—", "N/A", "NA"]);
const NON_DRIVER_WORDS = /^(고장|수리|예비장비|운전원교대|운전원 교대|점검|주유)$/;

function normalizeOptionalText(raw: string | null | undefined): string | null {
  const text = clean(raw);
  if (!text) {
    return null;
  }
  const compactUpper = text.replace(/\s+/g, "").toUpperCase();
  if (EMPTY_PLACEHOLDER_VALUES.has(compactUpper)) {
    return null;
  }
  return text;
}

function normalizeDriverName(raw: string | null | undefined): string | null {
  const text = normalizeOptionalText(raw);
  if (!text) {
    return null;
  }
  if (NON_DRIVER_WORDS.test(text)) {
    return null;
  }
  return text;
}

function isYtEquipmentId(equipmentId: string): boolean {
  const normalized = equipmentId.toUpperCase().replace(/\s+/g, "");
  return /^YT-?\d+/.test(normalized);
}

function normalizeLabel(raw: string): string {
  return clean(raw).replace(/[\/:()\-]/g, "").replace(/\s+/g, "");
}

function parseNumeric(raw: string | null | undefined): number | null {
  if (!raw) {
    return null;
  }
  const matched = raw.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  if (!matched) {
    return null;
  }
  const value = Number(matched[0]);
  return Number.isFinite(value) ? value : null;
}

function parseOperatorCellHtml(html: string): { operator: string | null; helper: string | null } {
  const normalized = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .trim();

  const lines = normalized
    .split(/\n+/)
    .map((line) => clean(line))
    .filter(Boolean);

  if (lines.length === 0) {
    return { operator: null, helper: null };
  }

  const first = lines[0] || null;
  const helperLine = lines.slice(1).find((line) => normalizeOptionalText(line) !== null) || null;

  if (lines.length === 1 && first && /HK/i.test(first)) {
    return {
      operator: null,
      helper: normalizeOptionalText(first),
    };
  }

  return {
    operator: normalizeDriverName(first),
    helper: normalizeOptionalText(helperLine),
  };
}

function createEmptyBundle(): NormalizedSnapshotBundle {
  return {
    vessels: [],
    cranes: [],
    equipment: [],
    yt: null,
    weather: null,
    diagnostics: [],
  };
}

const TARGET_GCS = [181, 182, 183, 184, 185, 186, 187, 188, 189, 190] as const;

function extractGcRemainFromTable($: ReturnType<typeof load>, table: any) {
  const rows = $(table).find("tr");
  if (!rows.length) {
    return [];
  }

  const header = rows
    .first()
    .find("th")
    .map((_, th) => clean($(th).text()))
    .get();

  if (!header.some((cell) => /Gantry\s*Crane/i.test(cell))) {
    return [];
  }

  const gcOrder = header
    .map((cell) => {
      const match = cell.match(/G\/?C\s*(\d+)/i);
      if (!match) {
        return null;
      }
      const gc = Number(match[1]);
      return TARGET_GCS.includes(gc as (typeof TARGET_GCS)[number]) ? gc : null;
    })
    .filter((value): value is number => value !== null);

  if (!gcOrder.length) {
    return [];
  }

  const hasWorkTypeRow = rows
    .slice(1, 2)
    .toArray()
    .some((row) => {
      const cells = $(row)
        .find("td")
        .map((_, td) => clean($(td).text()))
        .get();
      const first = cells[0] || "";
      const joined = cells.join(" ");
      return first.includes("작업") && joined.includes("양하") && joined.includes("적하");
    });

  if (!hasWorkTypeRow) {
    return [];
  }

  const dataRows = rows
    .toArray()
    .map((row) =>
      $(row)
        .find("td")
        .map((_, td) => clean($(td).text()))
        .get(),
    )
    .filter((cells) => cells.length > 2);

  const remainRow =
    dataRows.find((cells) => /^잔량$/.test(cells[0])) ||
    dataRows.find((cells) => cells[0].startsWith("잔량") && !cells[0].includes("소계"));

  if (!remainRow) {
    return [];
  }

  const extracted: Array<{ gc: number; discharge: number | null; load: number | null }> = [];
  gcOrder.forEach((gc, idx) => {
    const discharge = parseNumeric(remainRow[1 + idx * 2]);
    const load = parseNumeric(remainRow[2 + idx * 2]);
    extracted.push({ gc, discharge, load });
  });

  return extracted;
}

type ScheduleRowColor = "green" | "yellow" | "cyan" | "unknown";

const ROW_COLOR_REFERENCE: Record<Exclude<ScheduleRowColor, "unknown">, [number, number, number]> = {
  green: [109, 214, 109],
  yellow: [254, 220, 143],
  cyan: [167, 238, 255],
};

function parseColorValue(input: string | null | undefined): [number, number, number] | null {
  if (!input) {
    return null;
  }
  const text = clean(input).toLowerCase();
  if (!text) {
    return null;
  }

  const hex = text.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const value = hex[1];
    return [
      Number.parseInt(value.slice(0, 2), 16),
      Number.parseInt(value.slice(2, 4), 16),
      Number.parseInt(value.slice(4, 6), 16),
    ];
  }

  const rgb = text.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgb) {
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  }

  return null;
}

function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function classifyScheduleColorByDistance(color: [number, number, number], tolerance = 80): ScheduleRowColor {
  let nearest: ScheduleRowColor = "unknown";
  let nearestDistance = Number.POSITIVE_INFINITY;

  (Object.keys(ROW_COLOR_REFERENCE) as Array<Exclude<ScheduleRowColor, "unknown">>).forEach((key) => {
    const distance = colorDistance(color, ROW_COLOR_REFERENCE[key]);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = key;
    }
  });

  return nearestDistance <= tolerance ? nearest : "unknown";
}

function classifyScheduleRowColor(rowClass: string | null | undefined, rowColorHint: string | null | undefined): ScheduleRowColor {
  const classText = clean(rowClass).toLowerCase();
  if (classText.includes("bg_closed")) {
    return "green";
  }
  if (classText.includes("bg_on")) {
    return "yellow";
  }
  if (classText.includes("bg_yet")) {
    return "cyan";
  }

  const rgb = parseColorValue(rowColorHint);
  if (rgb) {
    return classifyScheduleColorByDistance(rgb);
  }

  return "unknown";
}

function normalizeEtaValue(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }
  const iso = parseSeoulDate(raw);
  if (!iso) {
    return null;
  }
  return formatKst(iso).slice(0, 16).replace(" ", "T");
}

function findHeaderIndex(headers: string[], candidates: string[]): number {
  const normalizedHeaders = headers.map((header) => normalizeLabel(header));
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeLabel(candidate);
    const exact = normalizedHeaders.indexOf(normalizedCandidate);
    if (exact >= 0) {
      return exact;
    }
    const partial = normalizedHeaders.findIndex((value) => value.includes(normalizedCandidate));
    if (partial >= 0) {
      return partial;
    }
  }
  return -1;
}

function createVesselSignature(item: Omit<VesselScheduleItem, "signature">): string {
  return sha256(
    JSON.stringify({
      vesselKey: item.vesselKey,
      berth: item.berth,
      eta: item.eta,
      etd: item.etd,
      status: item.status,
      workStartAt: item.workStartAt,
      workEndAt: item.workEndAt,
      importCutoffAt: item.importCutoffAt,
    }),
  );
}

export function parseGwctScheduleList(html: string, seenAt: string, source: SourceId): NormalizedSnapshotBundle {
  const bundle = createEmptyBundle();
  const $ = load(html);
  const table = $(gwctSelectors.scheduleList.table)
    .toArray()
    .map((node) => $(node))
    .find((candidate) => {
      const headers = candidate
        .find(gwctSelectors.scheduleList.headerCells)
        .map((_, element) => normalizeLabel($(element).text()))
        .get();
      return headers.includes(normalizeLabel("모선항차")) && headers.includes(normalizeLabel("선박명"));
    });

  if (!table || !table.length) {
    bundle.diagnostics.push({
      parserName: "parseGwctScheduleList",
      reason: "schedule list table not found",
      diagnostics: {},
    });
    return bundle;
  }

  const headers: string[] = [];
  table.find(gwctSelectors.scheduleList.headerCells).each((_, element) => {
    headers.push(clean($(element).text()));
  });

  const voyageIdx = findHeaderIndex(headers, ["모선항차", "터미널항차"]);
  const vesselIdx = findHeaderIndex(headers, ["선박명"]);
  const etaIdx = findHeaderIndex(headers, ["입항 일시", "입항일시"]);

  if (voyageIdx < 0 || vesselIdx < 0 || etaIdx < 0) {
    bundle.diagnostics.push({
      parserName: "parseGwctScheduleList",
      reason: "schedule list required headers not found",
      diagnostics: {
        headers,
        voyageIdx,
        vesselIdx,
        etaIdx,
      },
    });
    return bundle;
  }

  const allRows = table
    .find("tr")
    .toArray()
    .map((row, index) => {
      const cells = $(row)
        .find("td")
        .map((_, td) => clean($(td).text()))
        .get();
      if (!cells.length || cells.length < headers.length) {
        return null;
      }

      const rowClass = clean($(row).attr("class"));
      const rowColorHint = clean($(row).attr("data-gwct-row-bg")) || clean($(row).attr("bgcolor")) || null;
      const rowColor = classifyScheduleRowColor(rowClass, rowColorHint);

      const labelMap: Record<string, string> = {};
      headers.forEach((header, headerIdx) => {
        labelMap[header] = cells[headerIdx] ?? "";
      });

      const terminalVoyage = cells[voyageIdx] || null;
      const vesselName = cells[vesselIdx] || null;
      const etaRaw = cells[etaIdx] || null;
      const etaIso = parseSeoulDate(etaRaw);
      const etaNormalized = normalizeEtaValue(etaRaw);

      if (!terminalVoyage || !vesselName) {
        return null;
      }

      return {
        index,
        rowClass,
        rowColor,
        labelMap,
        terminalVoyage,
        vesselName,
        etaRaw,
        etaIso,
        etaNormalized,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const firstYellowIndex = allRows.findIndex((row) => row.rowColor === "yellow");
  const firstNonGreenIndex = allRows.findIndex((row) => row.rowColor !== "green");
  const startIndex = firstYellowIndex >= 0 ? firstYellowIndex : firstNonGreenIndex;
  const startReason = firstYellowIndex >= 0 ? "first_yellow" : firstNonGreenIndex >= 0 ? "first_non_green" : "none";

  const watchRows =
    startIndex >= 0
      ? allRows.slice(startIndex).filter((row) => row.rowColor !== "green").slice(0, 11)
      : [];

  watchRows.forEach((row, watchIdx) => {
    const base: Omit<VesselScheduleItem, "signature"> = {
      source,
      vesselKey: row.terminalVoyage || `${row.vesselName}_${row.labelMap["선석"] || "UNK"}`,
      vesselName: row.vesselName,
      terminalVoyage: row.terminalVoyage,
      berth: row.labelMap["선석"] || null,
      shippingLine: row.labelMap["선사"] || null,
      route: row.labelMap["항로"] || null,
      eta: row.etaIso,
      etb: null,
      ata: null,
      etd: parseSeoulDate(row.labelMap["출항 일시"] || row.labelMap["출항일시"]),
      atd: null,
      status: null,
      workStartAt: parseSeoulDate(row.labelMap["작업 시작일시"]),
      workEndAt: parseSeoulDate(row.labelMap["작업 완료일시"]),
      importCutoffAt: parseSeoulDate(row.labelMap["반입 마감일시"]),
      rawLabelMap: {
        ...row.labelMap,
        _watchIndex: String(watchIdx + 1),
        _rowColor: row.rowColor,
        _rowClass: row.rowClass || "",
        _etaNormalized: row.etaNormalized || "",
        _watchStartReason: startReason,
      },
      seenAt,
    };

    bundle.vessels.push({
      ...base,
      signature: createVesselSignature(base),
    });
  });

  if (!bundle.vessels.length) {
    bundle.diagnostics.push({
      parserName: "parseGwctScheduleList",
      reason: "no schedule watch window rows parsed",
      diagnostics: {
        totalRows: allRows.length,
        startReason,
      },
    });
  }

  return bundle;
}

export function parseGwctScheduleChart(html: string, seenAt: string, source: SourceId): NormalizedSnapshotBundle {
  const bundle = createEmptyBundle();
  const $ = load(html);

  $(gwctSelectors.scheduleChart.detailTable).each((_, table) => {
    const labelMap: Record<string, string> = {};
    const pairs = $(table).find("tr");

    pairs.each((__, tr) => {
      const label = clean($(tr).find("td.label").first().text());
      const value = clean($(tr).find("td.value").first().text());
      if (label) {
        labelMap[label] = value;
      } else if (!label && value && !labelMap.status) {
        labelMap.status = value;
      }
    });

    const vesselName = labelMap["선박명"] || null;
    if (!vesselName) {
      return;
    }

    const terminalVoyage = labelMap["터미널항차"] || null;
    const berthRaw = labelMap["From-To비트/선교"] || null;
    const base: Omit<VesselScheduleItem, "signature"> = {
      source,
      vesselKey: terminalVoyage || `${vesselName}_${berthRaw || "UNK"}`,
      vesselName,
      terminalVoyage,
      berth: berthRaw,
      shippingLine: null,
      route: labelMap["항로"] || null,
      eta: parseSeoulDate(labelMap["입항일시"]),
      etb: null,
      ata: null,
      etd: parseSeoulDate(labelMap["출항일시"]),
      atd: null,
      status: labelMap.status || null,
      workStartAt: null,
      workEndAt: null,
      importCutoffAt: parseSeoulDate(labelMap["반입마감시간"]),
      rawLabelMap: labelMap,
      seenAt,
    };

    bundle.vessels.push({
      ...base,
      signature: createVesselSignature(base),
    });
  });

  if (!bundle.vessels.length) {
    bundle.diagnostics.push({
      parserName: "parseGwctScheduleChart",
      reason: "no vessel detail tables parsed",
      diagnostics: {
        tableCount: $(gwctSelectors.scheduleChart.detailTable).length,
      },
    });
  }

  return bundle;
}

function extractCraneStatsFromTable(
  $: ReturnType<typeof load>,
  table: any,
  vesselName: string | null,
  seenAt: string,
  source: SourceId,
): CraneStatus[] {
  const rows = $(table).find("tr");
  if (!rows.length) {
    return [];
  }

  const headerCells = rows
    .first()
    .find("th")
    .map((_, th) => clean($(th).text()))
    .get();

  const craneIndices: Array<{ craneId: string; dischargeIdx: number; loadIdx: number }> = [];
  for (let i = 0; i < headerCells.length; i += 1) {
    const text = headerCells[i];
    const match = text.match(/G\/?C\s*(\d+)/i);
    if (!match) {
      continue;
    }
    const craneId = `GC${match[1]}`;
    const dischargeIdx = i;
    const loadIdx = i + 1;
    craneIndices.push({ craneId, dischargeIdx, loadIdx });
  }

  const rowMap = new Map<string, string[]>();
  rows.each((_, row) => {
    const cells = $(row)
      .find("td")
      .map((__, td) => clean($(td).text()))
      .get();
    if (!cells.length) {
      return;
    }
    const label = cells[0];
    rowMap.set(label, cells);
  });

  const sumRow = rowMap.get("합계") || [];
  const remainRow = rowMap.get("잔량") || [];

  const craneStatuses: CraneStatus[] = [];
  for (const idx of craneIndices) {
    const dischargeDone = parseNumeric(sumRow[idx.dischargeIdx]);
    const loadDone = parseNumeric(sumRow[idx.loadIdx]);
    const dischargeRemaining = parseNumeric(remainRow[idx.dischargeIdx]);
    const loadRemaining = parseNumeric(remainRow[idx.loadIdx]);
    const totalRemaining =
      dischargeRemaining !== null || loadRemaining !== null
        ? (dischargeRemaining || 0) + (loadRemaining || 0)
        : null;

    const status: Omit<CraneStatus, "signature"> = {
      source,
      craneId: idx.craneId,
      vesselName,
      dischargeDone,
      loadDone,
      dischargeRemaining,
      loadRemaining,
      totalRemaining,
      progressPercent: null,
      seenAt,
    };

    craneStatuses.push({
      ...status,
      signature: sha256(JSON.stringify(status)),
    });
  }

  return craneStatuses;
}

export function parseGwctWorkStatus(html: string, seenAt: string, source: SourceId): NormalizedSnapshotBundle {
  const bundle = createEmptyBundle();
  const $ = load(html);

  const headings = $("h3")
    .map((_, h3) => clean($(h3).text()))
    .get();

  $(gwctSelectors.workStatus.table).each((index, table) => {
    const tableText = clean($(table).text());
    if (!tableText.includes("Gantry Crane")) {
      return;
    }
    const heading = headings[index] || headings[Math.max(0, index - 1)] || "";
    const vesselName = clean(heading.replace(/^[^A-Za-z0-9]+/, "").split("(")[0]) || null;

    const craneRows = extractCraneStatsFromTable($, table, vesselName, seenAt, source);
    bundle.cranes.push(...craneRows);
  });

  if (!bundle.cranes.length) {
    bundle.diagnostics.push({
      parserName: "parseGwctWorkStatus",
      reason: "no crane status rows parsed",
      diagnostics: {
        tableCount: $(gwctSelectors.workStatus.table).length,
      },
    });
  }

  return bundle;
}

export function parseGwctGcRemaining(html: string, seenAt: string, source: SourceId): NormalizedSnapshotBundle {
  const bundle = createEmptyBundle();
  const $ = load(html);

  const aggregate = new Map<number, { discharge: number | null; load: number | null }>();
  let candidateTableCount = 0;
  let matchedTableCount = 0;
  TARGET_GCS.forEach((gc) => {
    aggregate.set(gc, { discharge: null, load: null });
  });

  $(gwctSelectors.workStatus.table).each((_, table) => {
    const tableText = clean($(table).text());
    if (!tableText.includes("Gantry Crane")) {
      return;
    }
    candidateTableCount += 1;

    const parsed = extractGcRemainFromTable($, table);
    if (parsed.length > 0) {
      matchedTableCount += 1;
    }
    parsed.forEach((item) => {
      const prev = aggregate.get(item.gc);
      if (!prev) {
        return;
      }
      if (item.discharge !== null) {
        prev.discharge = (prev.discharge ?? 0) + item.discharge;
      }
      if (item.load !== null) {
        prev.load = (prev.load ?? 0) + item.load;
      }
    });
  });

  let nonNullSubtotalCount = 0;
  for (const gc of TARGET_GCS) {
    const values = aggregate.get(gc)!;
    if (values.discharge !== null) {
      nonNullSubtotalCount += 1;
    }
    if (values.load !== null) {
      nonNullSubtotalCount += 1;
    }

    const status: Omit<CraneStatus, "signature"> = {
      source,
      craneId: `GC${gc}`,
      vesselName: null,
      dischargeDone: null,
      loadDone: null,
      dischargeRemaining: values.discharge,
      loadRemaining: values.load,
      totalRemaining:
        values.discharge !== null || values.load !== null
          ? (values.discharge || 0) + (values.load || 0)
          : null,
      progressPercent: null,
      seenAt,
    };
    bundle.cranes.push({
      ...status,
      signature: sha256(JSON.stringify(status)),
    });
  }

  if (candidateTableCount === 0) {
    bundle.diagnostics.push({
      parserName: "parseGwctGcRemaining",
      reason: "gc remaining candidate tables not found",
      diagnostics: {
        candidateTableCount,
        matchedTableCount,
        nonNullSubtotalCount,
      },
    });
  } else if (matchedTableCount === 0) {
    bundle.diagnostics.push({
      parserName: "parseGwctGcRemaining",
      reason: "gc remaining table structure not matched",
      diagnostics: {
        candidateTableCount,
        matchedTableCount,
        nonNullSubtotalCount,
      },
    });
  } else if (nonNullSubtotalCount === 0) {
    bundle.diagnostics.push({
      parserName: "parseGwctGcRemaining",
      reason: "gc remaining subtotal values not found",
      diagnostics: {
        candidateTableCount,
        matchedTableCount,
        nonNullSubtotalCount,
      },
    });
  }

  return bundle;
}

export function parseGwctEquipmentStatus(html: string, seenAt: string, source: SourceId): NormalizedSnapshotBundle {
  const bundle = createEmptyBundle();
  const $ = load(html);

  const equipmentRows: EquipmentLoginStatus[] = [];
  let ytKnown = 0;
  let ytLoggedIn = 0;

  $(gwctSelectors.equipment.table).each((_, table) => {
    const header = $(table)
      .find("tr")
      .first()
      .find("th")
      .map((__, th) => clean($(th).text()))
      .get();

    if (header.length < 4 || header[0] !== "장비") {
      return;
    }

    $(table)
      .find("tr")
      .slice(1)
      .each((__, row) => {
        const cells = $(row).find("td");
        if (cells.length < 4) {
          return;
        }

        const equipmentId = clean(cells.eq(0).text());
        if (!equipmentId) {
          return;
        }

        const operatorHtml = cells.eq(1).html() || "";
        const operatorParsed = parseOperatorCellHtml(operatorHtml);
        const loginText = normalizeOptionalText(cells.eq(2).text());
        const stopReason = normalizeOptionalText(cells.eq(3).text());

        const record: Omit<EquipmentLoginStatus, "signature"> = {
          source,
          equipmentId,
          operatorName: operatorParsed.operator,
          helperName: operatorParsed.helper,
          loginText,
          stopReason,
          seenAt,
        };

        equipmentRows.push({
          ...record,
          signature: sha256(JSON.stringify(record)),
        });

        if (isYtEquipmentId(equipmentId)) {
          ytKnown += 1;
          const loggedIn = record.operatorName !== null;
          if (loggedIn) {
            ytLoggedIn += 1;
          }
        }
      });
  });

  bundle.equipment = equipmentRows;

  if (ytKnown > 0) {
    const ytBase: Omit<YTCountSnapshot, "signature"> = {
      source,
      totalLoggedIn: ytLoggedIn,
      totalKnown: ytKnown,
      threshold: null,
      seenAt,
    };
    bundle.yt = {
      ...ytBase,
      signature: sha256(JSON.stringify(ytBase)),
    };
  }

  if (!bundle.equipment.length) {
    bundle.diagnostics.push({
      parserName: "parseGwctEquipmentStatus",
      reason: "no equipment rows parsed",
      diagnostics: {
        tableCount: $(gwctSelectors.equipment.table).length,
      },
    });
  }

  return bundle;
}

export function mergeDiagnostics(...diagnostics: ParserDiagnostics[][]): ParserDiagnostics[] {
  return diagnostics.flat();
}
