import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useEndpoint } from "../hooks/useEndpoint";
import { API_URLS } from "../lib/config";

interface YtResponse {
  source: string;
  threshold: number;
  snapshot: {
    totalLoggedIn: number;
    totalKnown: number;
    seenAt: string;
  } | null;
}

export default function YtScreen() {
  const { data, loading, refresh } = useEndpoint<YtResponse>(API_URLS.yt);

  const count = data?.snapshot?.totalLoggedIn ?? 0;
  const threshold = data?.threshold ?? 0;
  const isLow = count <= threshold;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}
    >
      <View style={styles.card}>
        <Text style={styles.title}>YT 현재 로그인</Text>
        <Text style={[styles.count, isLow ? styles.low : styles.normal]}>{count} / {data?.snapshot?.totalKnown ?? 0}</Text>
        <Text style={styles.meta}>임계치: {threshold}</Text>
        <Text style={styles.meta}>갱신시각: {data?.snapshot?.seenAt || "-"}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#eef4fb" },
  content: { padding: 16 },
  card: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#d8e4f0", borderRadius: 12, padding: 14 },
  title: { fontSize: 16, fontWeight: "700", color: "#123b60" },
  count: { fontSize: 36, fontWeight: "800", marginTop: 10 },
  normal: { color: "#145b1f" },
  low: { color: "#9d1f1f" },
  meta: { fontSize: 13, color: "#2e5a80", marginTop: 5 },
});
