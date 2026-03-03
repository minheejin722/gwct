import { useMemo, useState } from "react";
import { RefreshControl, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useEndpoint } from "../../hooks/useEndpoint";
import { API_URLS } from "../../lib/config";

type EventFilter = "all" | "yt" | "stopReason" | "loginChange";

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
  }>;
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
  const [filter, setFilter] = useState<EventFilter>("all");
  const { data, loading, error, refresh } = useEndpoint<EventsResponse>(`${API_URLS.events}?limit=200`, {
    pollMs: 15000,
  });

  const filteredItems = useMemo(() => {
    return (data?.items || []).filter((item) => matchFilter(item.type, item.category, filter));
  }, [data?.items, filter]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}
    >
      {error ? <Text style={styles.error}>서버 연결 실패, 재시도중…</Text> : null}

      <View style={styles.filters}>
        {([
          ["all", "전체"],
          ["yt", "yt"],
          ["stopReason", "stopReason"],
          ["loginChange", "loginChange"],
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
          <Text style={styles.type}>{item.type}</Text>
          <Text style={styles.summary}>{item.title}</Text>
          <Text style={styles.message}>{item.message}</Text>
        </View>
      ))}

      {!filteredItems.length ? <Text style={styles.empty}>이벤트 내역이 없습니다.</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#eef4fb" },
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
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filterButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#bfd3e7",
    backgroundColor: "#f7fbff",
  },
  filterActive: {
    backgroundColor: "#0f3b63",
    borderColor: "#0f3b63",
  },
  filterText: { fontSize: 12, color: "#245074", fontWeight: "600" },
  filterTextActive: { color: "#fff" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d8e4f0",
    padding: 12,
    gap: 4,
  },
  time: { fontSize: 12, color: "#5f7890" },
  type: { fontSize: 12, color: "#0f3b63", fontWeight: "700" },
  summary: { fontSize: 15, color: "#123454", fontWeight: "700" },
  message: { fontSize: 13, color: "#2d5478" },
  empty: { textAlign: "center", marginTop: 40, color: "#5f7890" },
});
