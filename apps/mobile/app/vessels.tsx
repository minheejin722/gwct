import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useEndpoint } from "../hooks/useEndpoint";
import { API_URLS } from "../lib/config";

interface VesselsResponse {
  source: string;
  count: number;
  items: Array<{
    vesselKey: string;
    vesselName: string;
    berth: string | null;
    eta: string | null;
    etd: string | null;
    status: string | null;
  }>;
}

export default function VesselsScreen() {
  const { data, loading, refresh } = useEndpoint<VesselsResponse>(API_URLS.vessels);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}
    >
      {(data?.items || []).map((item) => (
        <View key={item.vesselKey} style={styles.card}>
          <Text style={styles.title}>{item.vesselName}</Text>
          <Text style={styles.meta}>선석: {item.berth || "-"}</Text>
          <Text style={styles.meta}>ETA: {item.eta || "-"}</Text>
          <Text style={styles.meta}>ETD: {item.etd || "-"}</Text>
          <Text style={styles.meta}>상태: {item.status || "-"}</Text>
        </View>
      ))}
      {!data?.items?.length && <Text style={styles.empty}>선박 데이터가 없습니다.</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#eef4fb" },
  content: { padding: 16, gap: 10 },
  card: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#d8e4f0", borderRadius: 12, padding: 12 },
  title: { fontSize: 16, fontWeight: "700", color: "#123b60" },
  meta: { fontSize: 13, color: "#2e5a80", marginTop: 2 },
  empty: { textAlign: "center", color: "#5f7890", marginTop: 40 },
});
