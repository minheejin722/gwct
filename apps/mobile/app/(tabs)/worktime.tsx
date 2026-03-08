import { useMemo } from "react";
import type { YTWorkSessionResponse, YTSemanticState, YTWorkShiftIndicator } from "@gwct/shared";
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

function stateLabel(state: YTSemanticState): string {
  if (state === "active") {
    return "운전중";
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

function buildFallbackShiftStatus(): YTWorkShiftIndicator {
  return {
    state: "idle",
    reason: "no_snapshot",
    mode: null,
    label: "공백",
    detail: "집계 데이터 대기 중",
  };
}

function statusAccessibilityLabel(shiftStatus: YTWorkShiftIndicator): string {
  return shiftStatus.detail ? `${shiftStatus.label}, ${shiftStatus.detail}` : shiftStatus.label;
}

function StatusShape({
  shiftStatus,
  styles,
}: {
  shiftStatus: YTWorkShiftIndicator;
  styles: ReturnType<typeof createStyles>;
}) {
  if (shiftStatus.reason === "break_time") {
    return <View accessibilityLabel={statusAccessibilityLabel(shiftStatus)} style={styles.statusTriangle} />;
  }

  if (shiftStatus.state === "collecting") {
    return <View accessibilityLabel={statusAccessibilityLabel(shiftStatus)} style={styles.statusCircle} />;
  }

  return <View accessibilityLabel={statusAccessibilityLabel(shiftStatus)} style={styles.statusSquare} />;
}

export default function WorkTimeScreen() {
  const { colors, resolvedTheme } = useAppPreferences();
  const styles = useMemo(() => createStyles(colors, resolvedTheme), [colors, resolvedTheme]);
  const { data, loading, error, refresh } = useEndpoint<YTWorkSessionResponse>(API_URLS.ytWorkTime, {
    pollMs: 20000,
  });

  const session = data?.session || null;
  const drivers = session?.drivers || [];
  const shiftStatus = data?.shiftStatus || buildFallbackShiftStatus();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}
    >
      {error ? <Text style={styles.error}>서버 연결 실패: {error}</Text> : null}

      <View style={styles.rulesCard}>
        <View style={styles.statusDock}>
          <StatusShape shiftStatus={shiftStatus} styles={styles} />
        </View>

        <View style={styles.rulesBody}>
          <Text style={styles.rulesTitle}>🚜 YT Work Hour Rules</Text>

          <View style={styles.rulesSection}>
            <Text style={styles.rulesSectionTitle}>⏱ Shift Schedule</Text>

            <View style={styles.rulesRow}>
              <Text style={styles.rulesMarker}>•</Text>
              <Text style={styles.rulesIcon}>☀️</Text>
              <Text style={styles.rulesItemText}>Day Shift: 06:45 - 18:45</Text>
            </View>

            <View style={styles.rulesRow}>
              <Text style={styles.rulesMarker}>•</Text>
              <Text style={styles.rulesIcon}>🌙</Text>
              <Text style={styles.rulesItemText}>Night Shift: 18:45 - 06:45</Text>
            </View>
          </View>

          <View style={styles.rulesSection}>
            <Text style={styles.rulesSectionTitle}>🏗️ Time Adjustments</Text>

            <View style={styles.rulesRow}>
              <Text style={styles.rulesMarker}>•</Text>
              <Text style={styles.rulesIcon}>＋</Text>
              <Text style={styles.rulesItemText}>Over-height: +30 mins</Text>
            </View>

            <View style={styles.rulesRow}>
              <Text style={styles.rulesMarker}>•</Text>
              <Text style={styles.rulesIcon}>ー</Text>
              <Text style={styles.rulesItemText}>Restroom Break: -15 mins</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.listCard}>
        <Text style={styles.sectionTitle}>YT Driver Work Hour Rank</Text>

        {!drivers.length ? (
          <Text style={styles.emptyText}>아직 집계된 YT 기사 데이터가 없습니다.</Text>
        ) : (
          drivers.map((driver, index) => {
            const isInactive = driver.latestState === "stopped" || driver.latestState === "logged_out";
            const showReason = isInactive && Boolean(driver.latestStopReason);
            const showStoppedAt = isInactive;
            const stopCounterSummary = driver.stopReasonCounters.map((item) => `${item.label} ${item.count}회`).join("  ");

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
                  <Text style={styles.summaryText}>세그먼트 {driver.segments + (driver.currentSegmentStartedAt ? 1 : 0)}개</Text>
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
  const rulesCardBackground = resolvedTheme === "dark" ? "#0d1117" : "#fbfcfe";
  const rulesCardBorder = resolvedTheme === "dark" ? "#202833" : "#d8e0e8";
  const rulesPrimaryText = resolvedTheme === "dark" ? "#f3f6fb" : "#18212b";
  const rulesSecondaryText = resolvedTheme === "dark" ? "#c4ccd7" : "#425061";
  const rulesMutedText = resolvedTheme === "dark" ? "#919cab" : "#64748b";
  const rulesShadow = resolvedTheme === "dark" ? 0.26 : 0.12;

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
    rulesCard: {
      position: "relative",
      backgroundColor: rulesCardBackground,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: rulesCardBorder,
      paddingHorizontal: 18,
      paddingVertical: 18,
      shadowColor: "#000000",
      shadowOpacity: rulesShadow,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 12 },
      elevation: 4,
    },
    statusDock: {
      position: "absolute",
      top: 18,
      right: 18,
      width: 72,
      alignItems: "center",
      justifyContent: "flex-start",
    },
    statusCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: "#2c7fe3",
      shadowColor: "#2c7fe3",
      shadowOpacity: 0.28,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 0 },
      elevation: 3,
    },
    statusTriangle: {
      width: 0,
      height: 0,
      borderLeftWidth: 28,
      borderRightWidth: 28,
      borderBottomWidth: 50,
      borderLeftColor: "transparent",
      borderRightColor: "transparent",
      borderBottomColor: "#e25757",
      marginTop: 2,
    },
    statusSquare: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: resolvedTheme === "dark" ? "#657182" : "#a7b2bf",
    },
    rulesBody: {
      paddingRight: 88,
      gap: 18,
    },
    rulesTitle: {
      fontSize: 18,
      lineHeight: 24,
      fontWeight: "800",
      color: rulesPrimaryText,
    },
    rulesSection: {
      gap: 12,
    },
    rulesSectionTitle: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "800",
      color: rulesPrimaryText,
    },
    rulesRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      minHeight: 20,
    },
    rulesMarker: {
      width: 12,
      fontSize: 16,
      lineHeight: 18,
      color: rulesMutedText,
      textAlign: "center",
    },
    rulesIcon: {
      width: 24,
      fontSize: 16,
      lineHeight: 18,
      color: rulesPrimaryText,
      textAlign: "center",
    },
    rulesItemText: {
      flex: 1,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "700",
      color: rulesSecondaryText,
    },
    listCard: {
      backgroundColor: colors.surfaceBackground,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 10,
    },
    sectionTitle: { fontSize: 18, fontWeight: "800", color: colors.primaryText },
    emptyText: { fontSize: 13, lineHeight: 18, color: colors.secondaryText },
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
