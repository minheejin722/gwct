import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, RefreshControl, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import EventSource from "react-native-sse";
import { useEndpoint } from "../../hooks/useEndpoint";
import { API_URLS } from "../../lib/config";
import { useAppPreferences } from "../../lib/appPreferences";

type EventFilter = "all" | "yt" | "stopReason" | "loginChange" | "weather";

interface WeatherDebugPayload {
  dispatchTeamText?: string | null;
  standbyCallText?: string | null;
  matchedKeywords?: string[];
  normalizedReason?: string | null;
}

interface YtUnitDebugPayload {
  transitionKind?: string;
  ytNo?: string;
  driverName?: string | null;
  previousState?: string;
  currentState?: string;
  previousReason?: string | null;
  currentReason?: string | null;
  loginTime?: string | null;
}

interface EventsResponse {
  count: number;
  items: Array<{
    id: string;
    category: string;
    type: string;
    title: string;
    message: string;
    beforeValue: string | null;
    afterValue: string | null;
    occurredAt: string;
    payload?: WeatherDebugPayload & YtUnitDebugPayload;
  }>;
}

interface ClearEventsResponse {
  ok: boolean;
  clearedAt: string;
  deleted: {
    alertEvents: number;
    vesselScheduleChangeEvents: number;
    equipmentLoginEvents: number;
    weatherAlertEvents: number;
    notificationLogs: number;
  };
}

function eventLabel(type: string): string {
  if (type === "yt_unit_status_changed") {
    return "YT 상태 변경";
  }
  if (type === "yt_count_low") {
    return "YT 로그인 하회";
  }
  if (type === "yt_count_recovered") {
    return "YT 로그인 회복";
  }
  return type;
}

function matchFilter(type: string, category: string, filter: EventFilter): boolean {
  if (filter === "all") {
    return true;
  }
  if (filter === "yt") {
    return category === "YT" || type.startsWith("yt_");
  }
  if (filter === "stopReason") {
    return type.includes("stop_reason");
  }
  if (filter === "loginChange") {
    return type.includes("driver") || type.includes("hk_") || type.includes("login_time");
  }
  if (filter === "weather") {
    return category === "WEATHER";
  }
  return true;
}

function fmtTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("ko-KR", { hour12: false });
}

export default function AlertsScreen() {
  const { colors } = useAppPreferences();
  const styles = createStyles(colors);
  const [filter, setFilter] = useState<EventFilter>("all");
  const [clearing, setClearing] = useState(false);
  const { data, loading, error, refresh, setData } = useEndpoint<EventsResponse>(`${API_URLS.events}?limit=200`, {
    pollMs: 15000,
  });

  const filteredItems = useMemo(() => {
    return (data?.items || []).filter((item) => matchFilter(item.type, item.category, filter));
  }, [data?.items, filter]);

  const clearEventLogs = useCallback(async () => {
    setClearing(true);
    try {
      const response = await fetch(API_URLS.events, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const result = (await response.json()) as ClearEventsResponse;
      setData({ count: 0, items: [] });
      Alert.alert("삭제 완료", `이벤트 로그를 삭제했습니다. (${result.deleted.alertEvents}건)`);
    } catch (err) {
      Alert.alert("삭제 실패", `이벤트 로그 삭제 중 오류가 발생했습니다: ${(err as Error).message}`);
    } finally {
      setClearing(false);
    }
  }, [setData]);

  const confirmClearEventLogs = useCallback(() => {
    if (clearing) {
      return;
    }
    Alert.alert("이벤트 로그 전체 삭제", "저장된 이벤트 로그를 모두 삭제합니다. 계속 진행할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: () => {
          void clearEventLogs();
        },
      },
    ]);
  }, [clearEventLogs, clearing]);

  useEffect(() => {
    const es = new EventSource(API_URLS.sse);
    const onEventsCleared = () => {
      setData({ count: 0, items: [] });
    };

    es.addEventListener("events_cleared" as any, onEventsCleared as any);

    return () => {
      es.removeEventListener("events_cleared" as any, onEventsCleared as any);
      es.close();
    };
  }, [setData]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}
    >
      {error ? <Text style={styles.error}>서버 연결 실패, 재시도중…</Text> : null}

      <Pressable
        style={[styles.clearButton, clearing ? styles.clearButtonDisabled : null]}
        onPress={confirmClearEventLogs}
        disabled={clearing}
      >
        {clearing ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.clearButtonText}>이벤트 로그 전체 삭제</Text>
        )}
      </Pressable>

      <View style={styles.filters}>
        {([
          ["all", "전체"],
          ["yt", "yt"],
          ["stopReason", "stopReason"],
          ["loginChange", "loginChange"],
          ["weather", "weather"],
        ] as const).map(([key, label]) => (
          <Pressable
            key={key}
            style={[styles.filterButton, filter === key ? styles.filterActive : null]}
            onPress={() => setFilter(key)}
          >
            <Text style={[styles.filterText, filter === key ? styles.filterTextActive : null]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {filteredItems.map((item) => (
        <View key={item.id} style={styles.card}>
          <Text style={styles.time}>{fmtTime(item.occurredAt)}</Text>
          <Text style={styles.type}>{eventLabel(item.type)}</Text>
          <Text style={styles.summary}>{item.title}</Text>
          <Text style={styles.message}>{item.message}</Text>
          {item.type === "yt_unit_status_changed" ? (
              <>
              <Text style={styles.debug}>YT: {item.payload?.ytNo || "-"}</Text>
              <Text style={styles.debug}>Cabin: {item.payload?.driverName || "-"}</Text>
              <Text style={styles.debug}>
                전이: {item.payload?.previousState || "-"} {"->"} {item.payload?.currentState || "-"}
              </Text>
              <Text style={styles.debug}>
                중단사유: {item.payload?.previousReason || "-"} {"->"} {item.payload?.currentReason || "-"}
              </Text>
              <Text style={styles.debug}>로그인: {item.payload?.loginTime || "-"}</Text>
            </>
          ) : null}
          {item.category === "WEATHER" ? (
            <>
              <Text style={styles.debug}>배선팀근무: {item.payload?.dispatchTeamText || "-"}</Text>
              <Text style={styles.debug}>대기호출자: {item.payload?.standbyCallText || "-"}</Text>
              <Text style={styles.debug}>판정근거: {item.payload?.normalizedReason || "-"}</Text>
              <Text style={styles.debug}>
                키워드: {item.payload?.matchedKeywords?.length ? item.payload.matchedKeywords.join(", ") : "-"}
              </Text>
            </>
          ) : null}
        </View>
      ))}

      {!filteredItems.length ? <Text style={styles.empty}>이벤트 내역이 없습니다.</Text> : null}
    </ScrollView>
  );
}

function createStyles(colors: ReturnType<typeof useAppPreferences>["colors"]) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.screenBackground },
    content: { padding: 16, gap: 10 },
    error: {
      backgroundColor: "#fde8e8",
      borderWidth: 1,
      borderColor: "#e8a8a8",
      color: "#8b1a1a",
      padding: 10,
      borderRadius: 10,
      fontWeight: "700",
    },
    clearButton: {
      backgroundColor: "#9f1d1d",
      borderRadius: 10,
      minHeight: 42,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 12,
    },
    clearButtonDisabled: {
      opacity: 0.7,
    },
    clearButtonText: {
      color: "#ffffff",
      fontSize: 14,
      fontWeight: "800",
    },
    filters: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    filterButton: {
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceBackground,
    },
    filterActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    filterText: { fontSize: 12, color: colors.accentMuted, fontWeight: "600" },
    filterTextActive: { color: colors.surfaceBackground },
    card: {
      backgroundColor: colors.surfaceBackground,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      gap: 4,
    },
    time: { fontSize: 12, color: colors.secondaryText },
    type: { fontSize: 12, color: colors.accent, fontWeight: "700" },
    summary: { fontSize: 15, color: colors.primaryText, fontWeight: "700" },
    message: { fontSize: 13, color: colors.accentMuted },
    debug: { fontSize: 12, color: colors.secondaryText },
    empty: { textAlign: "center", marginTop: 40, color: colors.secondaryText },
  });
}
