export function clampProgressPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.floor(value)));
}

export const MIN_PROGRESS_THRESHOLD_PERCENT = 1;
export const MAX_PROGRESS_THRESHOLD_PERCENT = 100;

export function normalizeProgressThresholdPercent(value: number, fallback = MAX_PROGRESS_THRESHOLD_PERCENT): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return normalizeProgressThresholdPercent(fallback, MAX_PROGRESS_THRESHOLD_PERCENT);
  }
  const clamped = Math.max(MIN_PROGRESS_THRESHOLD_PERCENT, Math.min(MAX_PROGRESS_THRESHOLD_PERCENT, parsed));
  if (clamped >= 99 && clamped < 100) {
    return Math.round(clamped * 10) / 10;
  }
  return Math.round(clamped);
}

export function formatProgressThresholdPercent(value: number): string {
  const normalized = normalizeProgressThresholdPercent(value);
  return Number.isInteger(normalized) ? `${normalized}%` : `${normalized.toFixed(1)}%`;
}

export function derivePreciseProgressPercent(
  done: number | null | undefined,
  remaining: number | null | undefined,
  fallback: number | null | undefined = null,
): number | null {
  if (typeof done === "number" && typeof remaining === "number" && done + remaining > 0) {
    return Math.max(0, Math.min(100, (done / (done + remaining)) * 100));
  }
  if (typeof fallback === "number" && Number.isFinite(fallback)) {
    return Math.max(0, Math.min(100, fallback));
  }
  return null;
}

export function deriveProgressPercent(
  done: number | null | undefined,
  remaining: number | null | undefined,
  fallback: number | null | undefined = null,
): number | null {
  const precise = derivePreciseProgressPercent(done, remaining, fallback);
  if (precise !== null) {
    return clampProgressPercent(precise);
  }
  return null;
}
