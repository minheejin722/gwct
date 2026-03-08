import { useMemo } from "react";
import type { YTWorkSessionResponse, YTSemanticState, YTWorkShiftMode } from "@gwct/shared";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useEndpoint } from "../../hooks/useEndpoint";
import { useAppPreferences } from "../../lib/appPreferences";
import { API_URLS } from "../../lib/config";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function modeLabel(mode: YTWorkShiftMode): string {
  return mode === "day" ? "주간근무" : "야간근무";
}

function stateLabel(state: YTSemanticState): string {
  if (state === "active") {
    return "작업중";
  }
  if (state === "stopped") {
    return "중단";
  }
  return "로그아웃";
}

function rankLabel(index: number, total: number): string {
  if (total > 1 && index === total - 1) {
    return "꼴등";
  }
  return `${index + 1}등`;
}

export default function WorkTimeScreen() {
  const { colors, resolvedTheme } = useAppPreferences();
  const styles = useMemo(() => createStyles(colors, resolvedTheme), [colors, resolvedTheme]);
  const { data, loading, error, refresh } = useEndpoint<YTWorkSessionResponse>(API_URLS.ytWorkTime, {
    pollMs: 20000,
  });

  const session = data?.session || null;
  const drivers = session?.drivers || [];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}
    >
      {error ? <Text style={styles.error}>서버 연결 실패: {error}</Text> : null}

      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>YT 기사 일한 시간</Text>
        <Text style={styles.heroText}>주간 06:45~18:45, 야간 18:45~다음날 06:45를 자동 집계합니다.</Text>
        <Text style={styles.heroText}>점심 12:00~13:00, 자정 00:00~01:00 휴식시간은 자동 제외됩니다.</Text>
        <Text style={styles.heroMeta}>최근 YT 캡처: {formatDateTime(data?.latestYtCapturedAt || null)}</Text>
      </View>

      {session ? (
        <View style={styles.sessionCard}>
          <Text style={styles.sectionTitle}>{modeLabel(session.mode)} 집계</Text>
          <Text style={styles.meta}>Shift 시작: {formatDateTime(session.shiftWindowStartedAt)}</Text>
          <Text style={styles.meta}>현재 집계 시작: {formatDateTime(session.startedAt)}</Text>
          <Text style={styles.meta}>Shift 종료: {formatDateTime(session.endsAt)}</Text>
          <Text style={styles.meta}>마지막 반영: {formatDateTime(session.observedAt)}</Text>
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>최근 YT 데이터를 기다리는 중입니다.</Text>
          <Text style={styles.emptyText}>장비 스냅샷이 들어오면 현재 교대 기준으로 자동 집계가 시작됩니다.</Text>
        </View>
      )}

      <View style={styles.listCard}>
        <Text style={styles.sectionTitle}>YT 기사 일한 시간 순위</Text>
        {!drivers.length ? (
          <Text style={styles.emptyText}>아직 누적된 YT 기사 데이터가 없습니다.</Text>
        ) : (
          drivers.map((driver, index) => {
            const isInactive = driver.latestState === "stopped" || driver.latestState === "logged_out";
            const showReason = isInactive && Boolean(driver.latestStopReason);
            const showStoppedAt = isInactive;
            const stopCounterSummary = driver.stopReasonCounters
              .map((item) => `${item.label} ${item.count}회`)
              .join("  ");

            return (
              <View key={driver.driverKey} style={styles.driverCard}>
                <View style={styles.driverHeader}>
                  <View style={styles.driverIdentity}>
                    <View style={styles.driverNameRow}>
                      <Text style={styles.driverName}>{driver.driverName}</Text>
                      <Text style={styles.rankText}>{rankLabel(index, drivers.length)}</Text>
                    </View>
                  </View>
                  <View style={styles.workedValueRow}>
                    {driver.adjustmentDeltaLabel ? (
                      <Text
                        style={[
                          styles.adjustmentDeltaText,
                          driver.adjustmentDeltaMinutes > 0 ? styles.adjustmentPlus : styles.adjustmentMinus,
                        ]}
                      >
                        {driver.adjustmentDeltaLabel}
                      </Text>
                    ) : null}
                    <Text style={styles.workedLabel}>{driver.adjustedWorkedLabel}</Text>
                  </View>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryText}>YT {driver.activeYtNo || driver.latestYtNo || "-"}</Text>
                  <Text style={styles.summaryText}>
                    {stateLabel(driver.latestState)}
                    {showReason ? <Text style={styles.reasonText}> {driver.latestStopReason}</Text> : null}
                  </Text>
                  <Text style={styles.summaryText}>
                    세그먼트 {driver.segments + (driver.currentSegmentStartedAt ? 1 : 0)}회
                  </Text>
                </View>

                <View style={styles.timeStack}>
                  <View style={styles.timeBlock}>
                    <View style={styles.timeHeaderRow}>
                      <Text style={styles.timeLabel}>운전 시작</Text>
                      {stopCounterSummary ? <Text style={styles.counterSummary}>{stopCounterSummary}</Text> : null}
                    </View>
                    <Text style={styles.timeValue}>{formatDateTime(driver.firstSeenAt)}</Text>
                  </View>
                  {showStoppedAt ? (
                    <View style={styles.timeBlock}>
                      <Text style={styles.timeLabel}>운전 중지</Text>
                      <Text style={styles.timeValue}>{formatDateTime(driver.lastWorkedAt)}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

function createStyles(colors: ReturnType<typeof useAppPreferences>["colors"], resolvedTheme: "light" | "dark") {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.screenBackground },
    content: { padding: 16, gap: 14, paddingBottom: 28 },
    error: {
      backgroundColor: "#fde8e8",
      borderWidth: 1,
      borderColor: "#e8a8a8",
      color: "#8b1a1a",
      padding: 12,
      borderRadius: 12,
      fontWeight: "700",
    },
    heroCard: {
      backgroundColor: colors.surfaceBackground,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 8,
    },
    heroTitle: { fontSize: 22, fontWeight: "800", color: colors.primaryText },
    heroText: { fontSize: 14, lineHeight: 20, color: colors.secondaryText },
    heroMeta: { fontSize: 13, color: colors.secondaryText },
    sessionCard: {
      backgroundColor: colors.surfaceBackground,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 6,
    },
    sectionTitle: { fontSize: 18, fontWeight: "800", color: colors.primaryText },
    emptyCard: {
      backgroundColor: colors.surfaceBackground,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 6,
    },
    emptyTitle: { fontSize: 17, fontWeight: "800", color: colors.primaryText },
    emptyText: { fontSize: 13, lineHeight: 18, color: colors.secondaryText },
    meta: { fontSize: 13, color: colors.secondaryText },
    listCard: {
      backgroundColor: colors.surfaceBackground,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 10,
    },
    driverCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 10,
      backgroundColor: colors.elevatedBackground,
    },
    driverHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
    driverIdentity: { flex: 1, gap: 4 },
    driverNameRow: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", gap: 8 },
    rankText: { fontSize: 18, fontWeight: "800", color: colors.secondaryText },
    driverName: { fontSize: 20, fontWeight: "800", color: colors.primaryText },
    workedValueRow: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "flex-end",
      flexWrap: "wrap",
      gap: 8,
      flexShrink: 1,
    },
    workedLabel: {
      fontSize: 20,
      fontWeight: "800",
      color: colors.accent,
      textAlign: "right",
      flexShrink: 0,
    },
    adjustmentDeltaText: {
      fontSize: 13,
      fontWeight: "800",
      textAlign: "right",
    },
    adjustmentPlus: {
      color: colors.success,
    },
    adjustmentMinus: {
      color: colors.danger,
    },
    summaryRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 10,
    },
    summaryText: { fontSize: 13, color: colors.secondaryText, fontWeight: "600" },
    reasonText: { fontSize: 13, color: colors.danger, fontWeight: "700" },
    timeStack: { gap: 8 },
    timeBlock: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceBackground,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 4,
    },
    timeHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 10,
    },
    timeLabel: { fontSize: 12, fontWeight: "700", color: colors.secondaryText },
    counterSummary: {
      flex: 1,
      textAlign: "right",
      fontSize: 12,
      fontWeight: "700",
      color: colors.accentMuted,
    },
    timeValue: { fontSize: 15, fontWeight: "700", color: colors.primaryText },
  });
}
