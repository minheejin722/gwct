export type GwctEtaChangeDirection = "earlier" | "later";

export interface GwctEtaChangeSummary {
  previousEta: string;
  currentEta: string;
  deltaMinutes: number;
  direction: GwctEtaChangeDirection;
  crossedDate: boolean;
  humanMessage: string;
}

const ETA_ADJUSTMENT_SUFFIX_PATTERN = /\s+\d+번째 ETA 조정$/u;

interface ParsedEta {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const NORMALIZED_ETA_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function parseNormalizedEta(value: string): ParsedEta | null {
  const matched = value.match(NORMALIZED_ETA_PATTERN);
  if (!matched) {
    return null;
  }

  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  const hour = Number(matched[4]);
  const minute = Number(matched[5]);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute)
  ) {
    return null;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31 || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return { year, month, day, hour, minute };
}

function toUtcMinutes(value: ParsedEta): number {
  return Math.floor(Date.UTC(value.year, value.month - 1, value.day, value.hour, value.minute) / 60000);
}

function toUtcDateIndex(value: ParsedEta): number {
  return Math.floor(Date.UTC(value.year, value.month - 1, value.day) / 86400000);
}

function formatDuration(deltaMinutes: number): string {
  const absolute = Math.abs(deltaMinutes);
  const hours = Math.floor(absolute / 60);
  const minutes = absolute % 60;
  return `${hours}시간 ${minutes}분`;
}

function formatRelativeDayLabel(dayShift: number): string {
  if (dayShift === 1) {
    return "내일";
  }
  if (dayShift === 2) {
    return "모레";
  }
  if (dayShift > 2) {
    return `${dayShift}일 뒤`;
  }
  if (dayShift === -1) {
    return "어제";
  }
  if (dayShift === -2) {
    return "그제";
  }
  return `${Math.abs(dayShift)}일 전`;
}

export function formatGwctEtaAdjustmentMessage(humanMessage: string, adjustmentCount: number): string {
  const baseMessage = humanMessage.replace(ETA_ADJUSTMENT_SUFFIX_PATTERN, "").trim();
  if (!Number.isInteger(adjustmentCount) || adjustmentCount < 2) {
    return baseMessage;
  }
  return `${baseMessage} ${adjustmentCount}번째 ETA 조정`;
}

export function summarizeGwctEtaChange(previousEta: string, currentEta: string): GwctEtaChangeSummary | null {
  const previous = parseNormalizedEta(previousEta);
  const current = parseNormalizedEta(currentEta);
  if (!previous || !current) {
    return null;
  }

  const previousMinutes = toUtcMinutes(previous);
  const currentMinutes = toUtcMinutes(current);
  const deltaMinutes = currentMinutes - previousMinutes;
  if (deltaMinutes === 0) {
    return null;
  }

  const direction: GwctEtaChangeDirection = deltaMinutes < 0 ? "earlier" : "later";
  const previousDate = toUtcDateIndex(previous);
  const currentDate = toUtcDateIndex(current);
  const dayShift = currentDate - previousDate;
  const crossedDate = dayShift !== 0;
  const duration = formatDuration(deltaMinutes);

  let humanMessage: string;
  if (direction === "earlier" && !crossedDate) {
    humanMessage = `종전보다 ${duration} 더 일찍 입항 예정입니다.`;
  } else if (direction === "later" && !crossedDate) {
    humanMessage = `종전보다 ${duration} 더 늦게 입항 예정입니다.`;
  } else if (direction === "earlier") {
    humanMessage = `${formatRelativeDayLabel(dayShift)}로 ${duration} 더 일찍 입항 예정입니다.`;
  } else {
    humanMessage = `${formatRelativeDayLabel(dayShift)}로 ${duration} 더 늦게 입항 예정입니다.`;
  }

  return {
    previousEta,
    currentEta,
    deltaMinutes,
    direction,
    crossedDate,
    humanMessage,
  };
}
