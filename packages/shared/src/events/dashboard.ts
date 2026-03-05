export function formatDashboardCount(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }
  const normalized = Math.max(0, Math.trunc(value));
  return normalized.toLocaleString("ko-KR");
}

export function formatDashboardMetric(label: string, value: number): string {
  return `${label}: ${formatDashboardCount(value)}`;
}
