import { useMemo, useState } from "react";
import type { YTWorkSessionResponse, YTWorkShiftMode, YTSemanticState } from "@gwct/shared";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
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
  const { colors } = useAppPreferences();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data, loading, error, refresh } = useEndpoint<YTWorkSessionResponse>(API_URLS.ytWorkTime, {
    pollMs: 20000,
  });
  const [startingMode, setStartingMode] = useState<YTWorkShiftMode | null>(null);

  const session = data?.session || null;
  const drivers = session?.drivers || [];

  const startMode = async (mode: YTWorkShiftMode) => {
    setStartingMode(mode);
    try {
      const response = await fetch(API_URLS.ytWorkTimeStart, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(json.error || `HTTP ${response.status}`);
      }
      await refresh();
      Alert.alert("시작됨", `${modeLabel(mode)} 누적 카운팅을 시작했습니다.`);
    } catch (err) {
      Alert.alert("시작 실패", (err as Error).message);
    } finally {
      setStartingMode(null);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}
    >
      {error ? <Text style={styles.error}>서버 연결 실패: {error}</Text> : null}

      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>YT 기사 일한 시간</Text>
        <Text style={styles.heroText}>
          주간 또는 야간 카운팅을 시작하면 그 시점부터 YT 기사 active 상태만 누적합니다.
        </Text>
        <Text style={styles.heroMeta}>최근 YT 캡처: {formatDateTime(data?.latestYtCapturedAt || null)}</Text>
        <Text style={styles.heroMeta}>세션 상태: {session ? (session.status === "active" ? "진행중" : "종료") : "없음"}</Text>
      </View>

      <View style={styles.controlsCard}>
        <Text style={styles.sectionTitle}>Shift Start</Text>
        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.actionButton, styles.dayButton, startingMode ? styles.buttonDisabled : null]}
            onPress={() => void startMode("day")}
            disabled={Boolean(startingMode)}
          >
            {startingMode === "day" ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.actionButtonText}>주간근무 시작</Text>
            )}
          </Pressable>
          <Pressable
            style={[styles.actionButton, styles.nightButton, startingMode ? styles.buttonDisabled : null]}
            onPress={() => void startMode("night")}
            disabled={Boolean(startingMode)}
          >
            {startingMode === "night" ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.actionButtonText}>야간근무 시작</Text>
            )}
          </Pressable>
        </View>
        <Text style={styles.helperText}>주간 06:45~18:45, 야간 18:45~06:45 안에서만 시작할 수 있습니다.</Text>
      </View>

      {session ? (
        <View style={styles.sessionCard}>
          <Text style={styles.sectionTitle}>{modeLabel(session.mode)} 세션</Text>
          <Text style={styles.meta}>Shift 시작: {formatDateTime(session.shiftWindowStartedAt)}</Text>
          <Text style={styles.meta}>카운팅 시작: {formatDateTime(session.startedAt)}</Text>
          <Text style={styles.meta}>종료 시각: {formatDateTime(session.endsAt)}</Text>
          <Text style={styles.meta}>마지막 반영: {formatDateTime(session.observedAt)}</Text>
          {session.completedAt ? <Text style={styles.meta}>완료 처리: {formatDateTime(session.completedAt)}</Text> : null}
          {!!session.breaks.length ? (
            <View style={styles.breakRow}>
              {session.breaks.map((item) => (
                <View key={`${item.label}:${item.startAt}`} style={styles.breakChip}>
                  <Text style={styles.breakChipText}>
                    {item.label} {formatDateTime(item.startAt)} ~ {formatDateTime(item.endAt)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>활성 세션이 없습니다.</Text>
          <Text style={styles.emptyText}>주간근무 또는 야간근무 시작 버튼을 눌러 누적 카운팅을 시작하세요.</Text>
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

function createStyles(colors: ReturnType<typeof useAppPreferences>["colors"]) {
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
    controlsCard: {
      backgroundColor: colors.surfaceBackground,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 12,
    },
    sectionTitle: { fontSize: 18, fontWeight: "800", color: colors.primaryText },
    buttonRow: { flexDirection: "row", gap: 10 },
    actionButton: {
      flex: 1,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    dayButton: { backgroundColor: colors.accent },
    nightButton: { backgroundColor: colors.accentMuted },
    buttonDisabled: { opacity: 0.65 },
    actionButtonText: { color: "#ffffff", fontSize: 15, fontWeight: "800" },
    helperText: { fontSize: 12, lineHeight: 18, color: colors.secondaryText },
    sessionCard: {
      backgroundColor: colors.surfaceBackground,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 6,
    },
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
    breakRow: { gap: 8, marginTop: 6 },
    breakChip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 10,
      paddingVertical: 8,
      backgroundColor: colors.elevatedBackground,
    },
    breakChipText: { fontSize: 12, color: colors.secondaryText, fontWeight: "600" },
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
