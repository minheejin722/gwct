import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useEndpoint } from "../hooks/useEndpoint";
import { API_URLS } from "../lib/config";

interface CranesResponse {
  count: number;
  items: Array<{
    craneId: string;
    vesselName: string | null;
    totalRemaining: number | null;
    dischargeRemaining: number | null;
    loadRemaining: number | null;
  }>;
}

export default function CranesScreen() {
  const { data, loading, refresh } = useEndpoint<CranesResponse>(API_URLS.cranes);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}
    >
      {(data?.items || []).map((item) => (
        <View key={item.craneId} style={styles.card}>
          <Text style={styles.title}>{item.craneId}</Text>
          <Text style={styles.meta}>선박: {item.vesselName || "-"}</Text>
          <Text style={styles.highlight}>잔량 합계: {item.totalRemaining ?? "-"}</Text>
          <Text style={styles.meta}>양하 잔량: {item.dischargeRemaining ?? "-"}</Text>
          <Text style={styles.meta}>적하 잔량: {item.loadRemaining ?? "-"}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#eef4fb" },
  content: { padding: 16, gap: 10 },
  card: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#d8e4f0", borderRadius: 12, padding: 12 },
  title: { fontSize: 16, fontWeight: "700", color: "#123b60" },
  meta: { fontSize: 13, color: "#2e5a80", marginTop: 2 },
  highlight: { fontSize: 15, color: "#7c1f1f", fontWeight: "700", marginTop: 4 },
});
