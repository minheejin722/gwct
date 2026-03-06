import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { ScreenLinkCard } from "../components/ScreenLinkCard";
import { useEndpoint } from "../hooks/useEndpoint";
import { useAppPreferences } from "../lib/appPreferences";
import { API_URLS } from "../lib/config";

type WeatherSemanticState = "NORMAL" | "SUSPENDED" | "UNKNOWN";
type WeatherSeverity = "normal" | "warning" | "critical";

interface WeatherSnapshot {
  source: "ys_forecast" | "ys_notice" | "ys_news";
  suspensionState: "none" | "partial" | "all";
  semanticState: WeatherSemanticState;
  dispatchTeamDutyText: string | null;
  standbyCallText: string | null;
  normalizedReason: string | null;
  dutyText: string | null;
  noticeHeadline: string | null;
  matchedKeywords: string[];
  severity: WeatherSeverity;
  seenAt: string;
}

interface WeatherResponse {
  forecast: WeatherSnapshot | null;
  notice: WeatherSnapshot | null;
  news: WeatherSnapshot | null;
  primary: WeatherSnapshot | null;
  monitor?: {
    enabled: boolean;
    lastChangedAt: string | null;
  };
}

function semanticLabel(state: WeatherSemanticState): string {
  switch (state) {
    case "SUSPENDED":
      return "도선 중단";
    case "NORMAL":
      return "정상";
    default:
      return "판정 보류";
  }
}

function boardSemanticLabel(snapshot: WeatherSnapshot | null): string {
  if (!snapshot) {
    return "근거 없음";
  }
  if (snapshot.semanticState === "SUSPENDED") {
    return "중단 키워드";
  }
  if (snapshot.semanticState === "NORMAL") {
    return "정상/재개 키워드";
  }
  return "참고 헤드라인";
}

function formatStamp(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function createStyles(colors: ReturnType<typeof useAppPreferences>["colors"]) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.screenBackground },
    content: { padding: 16, gap: 12, paddingBottom: 24 },
    card: {
      backgroundColor: colors.elevatedBackground,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      padding: 16,
      gap: 10,
    },
    heroRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    title: { fontSize: 18, fontWeight: "800", color: colors.primaryText },
    heroState: { fontSize: 26, fontWeight: "900" },
    critical: { color: colors.danger },
    warning: { color: colors.warning },
    normal: { color: colors.success },
    heroMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    metaPill: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: colors.surfaceBackground,
    },
    metaPillText: { fontSize: 12, fontWeight: "700", color: colors.secondaryText },
    label: { fontSize: 12, fontWeight: "700", color: colors.secondaryText },
    value: { fontSize: 15, lineHeight: 22, fontWeight: "700", color: colors.primaryText },
    block: { gap: 4 },
    blockGrid: { gap: 10 },
    reasonBox: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 12,
      backgroundColor: colors.surfaceBackground,
      gap: 8,
    },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
      backgroundColor: colors.surfaceBackground,
    },
    chipText: { fontSize: 12, fontWeight: "700", color: colors.accentMuted },
    boardCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 12,
      gap: 8,
      backgroundColor: colors.surfaceBackground,
    },
    boardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    boardTitle: { fontSize: 15, fontWeight: "800", color: colors.primaryText },
    boardBadge: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    boardHeadline: { fontSize: 14, lineHeight: 20, color: colors.primaryText },
    boardMeta: { fontSize: 12, color: colors.secondaryText },
  });
}

export default function WeatherScreen() {
  const { colors } = useAppPreferences();
  const styles = createStyles(colors);
  const { data, loading, refresh } = useEndpoint<WeatherResponse>(API_URLS.weather, {
    pollMs: 30000,
  });

  const primary = data?.primary || data?.forecast || null;
  const semantic = primary?.semanticState || "UNKNOWN";
  const stateStyle =
    semantic === "SUSPENDED" ? styles.critical : semantic === "NORMAL" ? styles.normal : styles.warning;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}
    >
      <View style={styles.card}>
        <View style={styles.heroRow}>
          <View style={styles.block}>
            <Text style={styles.title}>여수 도선예보현황</Text>
            <Text style={[styles.heroState, stateStyle]}>{semanticLabel(semantic)}</Text>
          </View>
        </View>
        <View style={styles.heroMetaRow}>
          <View style={styles.metaPill}>
            <Text style={styles.metaPillText}>감시 {data?.monitor?.enabled ? "ON" : "OFF"}</Text>
          </View>
          <View style={styles.metaPill}>
            <Text style={styles.metaPillText}>최종 판정 {formatStamp(primary?.seenAt)}</Text>
          </View>
          <View style={styles.metaPill}>
            <Text style={styles.metaPillText}>상태 전환 {formatStamp(data?.monitor?.lastChangedAt)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>현장 신호</Text>
        <View style={styles.blockGrid}>
          <View style={styles.block}>
            <Text style={styles.label}>배선팀근무</Text>
            <Text style={styles.value}>{data?.forecast?.dispatchTeamDutyText || "-"}</Text>
          </View>
          <View style={styles.block}>
            <Text style={styles.label}>대기호출자</Text>
            <Text style={styles.value}>{data?.forecast?.standbyCallText || data?.forecast?.dutyText || "-"}</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>판정 근거</Text>
        <View style={styles.reasonBox}>
          <View style={styles.block}>
            <Text style={styles.label}>Normalized Reason</Text>
            <Text style={styles.value}>{primary?.normalizedReason || "-"}</Text>
          </View>
          <View style={styles.block}>
            <Text style={styles.label}>Matched Keywords</Text>
            {primary?.matchedKeywords?.length ? (
              <View style={styles.chipRow}>
                {primary.matchedKeywords.map((keyword) => (
                  <View key={keyword} style={styles.chip}>
                    <Text style={styles.chipText}>{keyword}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.value}>-</Text>
            )}
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>보조 공지 근거</Text>

        <View style={styles.boardCard}>
          <View style={styles.boardHeader}>
            <Text style={styles.boardTitle}>공지사항</Text>
            <View
              style={[
                styles.boardBadge,
                {
                  borderColor:
                    data?.notice?.semanticState === "SUSPENDED"
                      ? colors.danger
                      : data?.notice?.semanticState === "NORMAL"
                        ? colors.success
                        : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.metaPillText,
                  {
                    color:
                      data?.notice?.semanticState === "SUSPENDED"
                        ? colors.danger
                        : data?.notice?.semanticState === "NORMAL"
                          ? colors.success
                          : colors.secondaryText,
                  },
                ]}
              >
                {boardSemanticLabel(data?.notice || null)}
              </Text>
            </View>
          </View>
          <Text style={styles.boardHeadline}>{data?.notice?.noticeHeadline || "관련 헤드라인 없음"}</Text>
          <Text style={styles.boardMeta}>갱신 {formatStamp(data?.notice?.seenAt)}</Text>
        </View>

        <View style={styles.boardCard}>
          <View style={styles.boardHeader}>
            <Text style={styles.boardTitle}>새소식</Text>
            <View
              style={[
                styles.boardBadge,
                {
                  borderColor:
                    data?.news?.semanticState === "SUSPENDED"
                      ? colors.danger
                      : data?.news?.semanticState === "NORMAL"
                        ? colors.success
                        : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.metaPillText,
                  {
                    color:
                      data?.news?.semanticState === "SUSPENDED"
                        ? colors.danger
                        : data?.news?.semanticState === "NORMAL"
                          ? colors.success
                          : colors.secondaryText,
                  },
                ]}
              >
                {boardSemanticLabel(data?.news || null)}
              </Text>
            </View>
          </View>
          <Text style={styles.boardHeadline}>{data?.news?.noticeHeadline || "관련 헤드라인 없음"}</Text>
          <Text style={styles.boardMeta}>갱신 {formatStamp(data?.news?.seenAt)}</Text>
        </View>
      </View>

      <ScreenLinkCard
        href="/monitor-yeosu"
        title="여수 도선중지 감시 설정"
        subtitle="Confirm/Cancel로 감시 활성/비활성"
      />
    </ScrollView>
  );
}
