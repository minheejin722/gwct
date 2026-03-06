import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { ScreenLinkCard } from "../../components/ScreenLinkCard";
import { useEndpoint } from "../../hooks/useEndpoint";
import { API_URLS } from "../../lib/config";

interface MonitorStatusResponse {
  config: {
    gwctEtaMonitor: { enabled: boolean; trackingCount: number };
    equipmentMonitor: {
      yt: { enabled: boolean; threshold: number };
      gcStaff: { enabled: boolean };
    };
    yeosuPilotageMonitor: { enabled: boolean };
  };
}

export default function SettingsScreen() {
  const { data, loading, error, refresh } = useEndpoint<MonitorStatusResponse>(API_URLS.monitorsStatus, {
    pollMs: 30000,
  });

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}
    >
      {error ? <Text style={styles.error}>Server connection failed, retrying...</Text> : null}

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Current Monitor Status</Text>
        <Text style={styles.summaryText}>
          GWCT ETA: {data?.config.gwctEtaMonitor.enabled ? "ON" : "OFF"} (N={data?.config.gwctEtaMonitor.trackingCount ?? 11})
        </Text>
        <Text style={styles.summaryText}>
          YT Count: {data?.config.equipmentMonitor.yt.enabled ? "ON" : "OFF"} (threshold {data?.config.equipmentMonitor.yt.threshold ?? 0})
        </Text>
        <Text style={styles.summaryText}>
          GC Cabin/Under: {data?.config.equipmentMonitor.gcStaff.enabled ? "ON" : "OFF"}
        </Text>
        <Text style={styles.summaryText}>
          Yeosu Pilotage: {data?.config.yeosuPilotageMonitor.enabled ? "ON" : "OFF"}
        </Text>
      </View>

      <View style={styles.links}>
        <ScreenLinkCard href="/monitor-gwct-eta" title="GWCT ETA Monitor" subtitle="Set N(1~11), then Confirm/Cancel" />
        <ScreenLinkCard href="/monitor-gc-remaining" title="GC Remaining" subtitle="Per-GC threshold and enable/disable" />
        <ScreenLinkCard href="/monitor-equipment" title="Equipment Monitor" subtitle="YT threshold + GC Cabin/Under on/off" />
        <ScreenLinkCard href="/monitor-yeosu" title="Yeosu Pilotage" subtitle="Pilotage suspension monitor on/off" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#eef4fb" },
  content: { padding: 16, gap: 12 },
  error: {
    backgroundColor: "#fde8e8",
    borderWidth: 1,
    borderColor: "#e8a8a8",
    color: "#8b1a1a",
    padding: 10,
    borderRadius: 10,
    fontWeight: "700",
  },
  summaryCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d8e4f0",
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  summaryTitle: { fontSize: 16, fontWeight: "800", color: "#123a5e" },
  summaryText: { fontSize: 13, color: "#2d5578" },
  links: { gap: 10 },
});
