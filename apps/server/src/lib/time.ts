const KST_OFFSET_HOURS = 9;

function toIsoFromKst(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): string {
  const utcMs = Date.UTC(year, month - 1, day, hour - KST_OFFSET_HOURS, minute, second);
  return new Date(utcMs).toISOString();
}

function currentKstYear(): number {
  const now = new Date();
  const kstMs = now.getTime() + KST_OFFSET_HOURS * 60 * 60 * 1000;
  return new Date(kstMs).getUTCFullYear();
}

export function nowIso(_tz: string): string {
  return new Date().toISOString();
}

export function parseSeoulDate(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }

  const text = raw.trim();
  if (!text) {
    return null;
  }

  let match = text.match(/^(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (match) {
    return toIsoFromKst(
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6] || 0),
    );
  }

  match = text.match(/^(\d{1,2})[\/.\-](\d{1,2})\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (match) {
    return toIsoFromKst(
      currentKstYear(),
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
      Number(match[4]),
      Number(match[5] || 0),
    );
  }

  match = text.match(/^(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})$/);
  if (match) {
    return toIsoFromKst(Number(match[1]), Number(match[2]), Number(match[3]));
  }

  match = text.match(/^(\d{1,2})[\/.\-](\d{1,2})$/);
  if (match) {
    return toIsoFromKst(currentKstYear(), Number(match[1]), Number(match[2]));
  }

  const parsed = Date.parse(text);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString();
  }

  return null;
}

export function compareIso(a: string | null, b: string | null): number | null {
  if (!a || !b) {
    return null;
  }

  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (Number.isNaN(ta) || Number.isNaN(tb)) {
    return null;
  }

  return ta - tb;
}

export function formatKst(input: string | Date, tz = "Asia/Seoul"): string {
  const date = typeof input === "string" ? new Date(input) : input;
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(date)
    .replace("T", " ");
}
