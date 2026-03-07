import { useMemo, useState } from "react";
import type {
  YTWorkAutoMode,
  YTWorkAutomationState,
  YTWorkSessionResponse,
  YTWorkShiftMode,
  YTSemanticState,
} from "@gwct/shared";
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

type SelectableAutoMode = Exclude<YTWorkAutoMode, "off">;

const DEFAULT_AUTOMATION: YTWorkAutomationState = {
  mode: "off",
  status: "off",
  armedAt: null,
  nextStartAt: null,
  nextMode: null,
};

const AUTO_OPTIONS: Array<{
  mode: SelectableAutoMode;
  title: string;
  description: string;
  wide?: boolean;
}> = [
  {
    mode: "full_auto",
    title: "24시간 주야",
    description: "주간 06:45, 야간 18:45마다 자동 전환됩니다.",
    wide: true,
  },
  {
    mode: "reserve_day",
    title: "주간 예약",
    description: "다음 주간 시작에 1회 자동 카운팅합니다.",
  },
  {
    mode: "reserve_night",
    title: "야간 예약",
    description: "다음 야간 시작에 1회 자동 카운팅합니다.",
  },
];

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

function autoModeLabel(mode: YTWorkAutoMode): string {
  if (mode === "full_auto") {
    return "24시간 주야";
  }
  if (mode === "reserve_day") {
    return "주간 예약";
  }
  if (mode === "reserve_night") {
    return "야간 예약";
  }
  return "자동 끔";
}

function autoStatusLabel(automation: YTWorkAutomationState): string {
  if (automation.mode === "off") {
    return "꺼짐";
  }
  return automation.status === "running" ? "작동중" : "대기중";
}

function autoSummaryText(automation: YTWorkAutomationState): string {
  if (automation.mode === "off") {
    return "자동 카운팅이 꺼져 있습니다.";
  }

  if (automation.status === "running") {
    if (automation.nextStartAt && automation.nextMode) {
      return `${autoModeLabel(automation.mode)} 작동중 · 다음 ${modeLabel(automation.nextMode)} ${formatDateTime(automation.nextStartAt)}`;
    }
    return `${autoModeLabel(automation.mode)} 작동중`;
  }

  if (automation.nextStartAt && automation.nextMode) {
    const nextStartMs = new Date(automation.nextStartAt).getTime();
    if (Number.isFinite(nextStartMs) && nextStartMs <= Date.now()) {
      return `${autoModeLabel(automation.mode)} 대기중 · 현재 교대 스냅샷이 들어오면 자동 시작됩니다.`;
    }
    return `${autoModeLabel(automation.mode)} 대기중 · 다음 ${modeLabel(automation.nextMode)} ${formatDateTime(automation.nextStartAt)}`;
  }

  return `${autoModeLabel(automation.mode)} 대기중`;
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
  const { data, loading, error, refresh, setData } = useEndpoint<YTWorkSessionResponse>(API_URLS.ytWorkTime, {
    pollMs: 20000,
  });
  const [startingMode, setStartingMode] = useState<YTWorkShiftMode | null>(null);
  const [savingAutomationMode, setSavingAutomationMode] = useState<YTWorkAutoMode | null>(null);

  const session = data?.session || null;
  const automation = data?.automation || DEFAULT_AUTOMATION;
  const drivers = session?.drivers || [];
  const controlsBusy = Boolean(startingMode || savingAutomationMode);

  const requestJson = async (url: string, body: Record<string, unknown>) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await response.json()) as YTWorkSessionResponse & { error?: string };
    if (!response.ok) {
      throw new Error(json.error || `HTTP ${response.status}`);
    }
    setData(json);
    return json;
  };

  const performStartMode = async (mode: YTWorkShiftMode) => {
    setStartingMode(mode);
    try {
      await requestJson(API_URLS.ytWorkTimeStart, { mode });
      Alert.alert("시작됨", `${modeLabel(mode)} 누적 카운팅을 시작했습니다.`);
    } catch (err) {
      Alert.alert("시작 실패", (err as Error).message);
    } finally {
      setStartingMode(null);
    }
  };

  const startMode = (mode: YTWorkShiftMode) => {
    if (automation.mode !== "off") {
      Alert.alert(
        "자동 설정 해제 후 시작",
        "수동 Shift Start를 누르면 현재 자동 설정이 해제됩니다.",
        [
          { text: "취소", style: "cancel" },
          {
            text: "시작",
            onPress: () => {
              void performStartMode(mode);
            },
          },
        ],
      );
      return;
    }

    void performStartMode(mode);
  };

  const updateAutomationMode = async (mode: YTWorkAutoMode) => {
    setSavingAutomationMode(mode);
    try {
      await requestJson(API_URLS.ytWorkTimeAutomation, { mode });
    } catch (err) {
      Alert.alert("자동 설정 실패", (err as Error).message);
    } finally {
      setSavingAutomationMode(null);
    }
  };

  const renderAutoOption = (option: (typeof AUTO_OPTIONS)[number]) => {
    const selected = automation.mode === option.mode;
    const saving = savingAutomationMode === option.mode;

    return (
      <Pressable
        key={option.mode}
        style={[
          styles.autoOptionCard,
          option.wide ? styles.autoOptionWide : styles.autoOptionHalf,
          selected ? styles.autoOptionSelected : null,
          controlsBusy ? styles.buttonDisabled : null,
        ]}
        onPress={() => void updateAutomationMode(option.mode)}
        disabled={controlsBusy}
      >
        <View style={styles.autoOptionHeader}>
          <Text style={[styles.autoOptionTitle, selected ? styles.autoOptionTitleSelected : null]}>{option.title}</Text>
          {saving ? <ActivityIndicator size="small" color={colors.accent} /> : null}
        </View>
        <Text style={[styles.autoOptionDescription, selected ? styles.autoOptionDescriptionSelected : null]}>
          {option.description}
        </Text>
      </Pressable>
    );
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
          수동으로 Shift Start를 누르거나, 아래 Auto Count에서 24시간 자동 또는 1회 예약을 설정할 수 있습니다.
        </Text>
        <Text style={styles.heroMeta}>최근 YT 캡처: {formatDateTime(data?.latestYtCapturedAt || null)}</Text>
        <Text style={styles.heroMeta}>세션 상태: {session ? (session.status === "active" ? "진행중" : "종료") : "없음"}</Text>
      </View>

      <View style={styles.controlsCard}>
        <Text style={styles.sectionTitle}>Shift Start</Text>
        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.actionButton, styles.dayButton, controlsBusy ? styles.buttonDisabled : null]}
            onPress={() => startMode("day")}
            disabled={controlsBusy}
          >
            {startingMode === "day" ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.actionButtonText}>주간근무 시작</Text>
            )}
          </Pressable>
          <Pressable
            style={[styles.actionButton, styles.nightButton, controlsBusy ? styles.buttonDisabled : null]}
            onPress={() => startMode("night")}
            disabled={controlsBusy}
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

      <View style={styles.autoCard}>
        <View style={styles.autoHeaderRow}>
          <View style={styles.autoHeaderText}>
            <Text style={styles.sectionTitle}>Auto Count</Text>
            <Text style={styles.autoIntro}>24시간 자동 또는 원하는 교대 1회 예약을 설정합니다.</Text>
          </View>
          <Pressable
            style={[
              styles.autoOffPill,
              automation.mode === "off" ? styles.autoOffPillSelected : null,
              controlsBusy ? styles.buttonDisabled : null,
            ]}
            onPress={() => void updateAutomationMode("off")}
            disabled={controlsBusy || automation.mode === "off"}
          >
            {savingAutomationMode === "off" ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Text style={[styles.autoOffPillText, automation.mode === "off" ? styles.autoOffPillTextSelected : null]}>
                자동 끔
              </Text>
            )}
          </Pressable>
        </View>

        {renderAutoOption(AUTO_OPTIONS[0])}

        <View style={styles.autoOptionRow}>
          {renderAutoOption(AUTO_OPTIONS[1])}
          {renderAutoOption(AUTO_OPTIONS[2])}
        </View>

        <View style={styles.autoStatusStrip}>
          <View
            style={[
              styles.autoStatusChip,
              automation.status === "running"
                ? styles.autoStatusChipRunning
                : automation.mode === "off"
                  ? styles.autoStatusChipOff
                  : styles.autoStatusChipArmed,
            ]}
          >
            <Text style={styles.autoStatusChipText}>
              {autoModeLabel(automation.mode)} · {autoStatusLabel(automation)}
            </Text>
          </View>
          <Text style={styles.autoStatusText}>{autoSummaryText(automation)}</Text>
        </View>

        <Text style={styles.helperText}>수동 Shift Start를 누르면 자동 설정이 즉시 해제됩니다.</Text>
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
          <Text style={styles.emptyText}>수동 시작 또는 Auto Count 예약으로 누적 카운팅을 시작하세요.</Text>
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
  const autoSelectedBackground = resolvedTheme === "dark" ? "#2a3746" : "#eef4fa";
  const autoOffBackground = resolvedTheme === "dark" ? "#2b3138" : "#eef1f4";
  const autoArmedBackground = resolvedTheme === "dark" ? "#3c3420" : "#fff1dd";
  const autoRunningBackground = resolvedTheme === "dark" ? "#263c2f" : "#e7f4ea";

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
    autoCard: {
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
    actionButtonText: { color: resolvedTheme === "dark" ? "#1c2b36" : "#ffffff", fontSize: 15, fontWeight: "800" },
    helperText: { fontSize: 12, lineHeight: 18, color: colors.secondaryText },
    autoHeaderRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
    },
    autoHeaderText: { flex: 1, gap: 4 },
    autoIntro: { fontSize: 13, lineHeight: 18, color: colors.secondaryText },
    autoOffPill: {
      minHeight: 34,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.elevatedBackground,
      paddingHorizontal: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    autoOffPillSelected: {
      borderColor: colors.accentMuted,
      backgroundColor: autoOffBackground,
    },
    autoOffPillText: { fontSize: 12, fontWeight: "700", color: colors.secondaryText },
    autoOffPillTextSelected: { color: colors.primaryText },
    autoOptionCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.elevatedBackground,
      paddingHorizontal: 14,
      paddingVertical: 14,
      gap: 8,
    },
    autoOptionWide: {
      minHeight: 98,
    },
    autoOptionHalf: {
      flex: 1,
      minHeight: 116,
    },
    autoOptionSelected: {
      borderColor: colors.accent,
      backgroundColor: autoSelectedBackground,
    },
    autoOptionRow: {
      flexDirection: "row",
      gap: 10,
    },
    autoOptionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    autoOptionTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.primaryText,
      flexShrink: 1,
    },
    autoOptionTitleSelected: {
      color: colors.accent,
    },
    autoOptionDescription: {
      fontSize: 12,
      lineHeight: 18,
      color: colors.secondaryText,
    },
    autoOptionDescriptionSelected: {
      color: colors.primaryText,
    },
    autoStatusStrip: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.elevatedBackground,
      paddingHorizontal: 12,
      paddingVertical: 12,
      gap: 8,
    },
    autoStatusChip: {
      alignSelf: "flex-start",
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    autoStatusChipOff: {
      backgroundColor: autoOffBackground,
    },
    autoStatusChipArmed: {
      backgroundColor: autoArmedBackground,
    },
    autoStatusChipRunning: {
      backgroundColor: autoRunningBackground,
    },
    autoStatusChipText: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.primaryText,
    },
    autoStatusText: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.primaryText,
      fontWeight: "600",
    },
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
