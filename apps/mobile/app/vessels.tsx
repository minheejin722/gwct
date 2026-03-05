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
    latestEtaChange: {
      eventId: string;
      occurredAt: string;
      previousEta: string;
      currentEta: string;
      deltaMinutes: number;
      direction: "earlier" | "later";
      crossedDate: boolean;
      humanMessage: string;
    } | null;
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
          {item.latestEtaChange ? (
            <View
              style={[
                styles.etaChangeBox,
                item.latestEtaChange.direction === "earlier" ? styles.etaEarlier : styles.etaLater,
              ]}
            >
              <Text
                style={[
                  styles.etaChangeText,
                  item.latestEtaChange.direction === "earlier" ? styles.etaEarlierText : styles.etaLaterText,
                ]}
              >
                {item.latestEtaChange.humanMessage}
              </Text>
            </View>
          ) : null}
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
  etaChangeBox: {
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  etaChangeText: {
    fontSize: 13,
    fontWeight: "700",
  },
  etaEarlier: {
    backgroundColor: "#ffecef",
    borderColor: "#ef9aa8",
  },
  etaEarlierText: {
    color: "#a3132f",
  },
  etaLater: {
    backgroundColor: "#eaf2ff",
    borderColor: "#93b9eb",
  },
  etaLaterText: {
    color: "#144d94",
  },
  empty: { textAlign: "center", color: "#5f7890", marginTop: 40 },
});
