import { useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useEndpoint } from "../hooks/useEndpoint";
import { API_URLS } from "../lib/config";

interface YeosuMonitorResponse {
  enabled: boolean;
  lastRawText: string | null;
  lastNormalizedState: "none" | "partial" | "all" | null;
  lastChangedAt: string | null;
  latestCapturedAt: string | null;
  latestForecastState: "none" | "partial" | "all";
  latestDutyText: string | null;
}

async function saveYeosuConfig(payload: Record<string, unknown>) {
  const response = await fetch(API_URLS.monitorYeosu, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

export default function MonitorYeosuScreen() {
  const { data, loading, error, refresh } = useEndpoint<YeosuMonitorResponse>(API_URLS.monitorYeosu, {
    pollMs: 25000,
  });
  const [saving, setSaving] = useState(false);

  const setEnabled = async (enabled: boolean) => {
    setSaving(true);
    try {
      await saveYeosuConfig({ enabled });
      await refresh();
      Alert.alert("Saved", `Yeosu pilotage monitor is now ${enabled ? "enabled" : "disabled"}.`);
    } catch (err) {
      Alert.alert("Save failed", (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}
    >
      {error ? <Text style={styles.error}>Server connection failed, retrying...</Text> : null}

      <View style={styles.card}>
        <Text style={styles.title}>Yeosu Pilotage Monitor</Text>
        <Text style={styles.meta}>Status: {data?.enabled ? "ACTIVE" : "INACTIVE"}</Text>
        <Text style={styles.meta}>Last captured: {data?.latestCapturedAt || "-"}</Text>
        <Text style={styles.meta}>Latest state: {(data?.latestForecastState || "none").toUpperCase()}</Text>
        <Text style={styles.meta}>Latest duty text: {data?.latestDutyText || "-"}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>State Machine Memory</Text>
        <Text style={styles.meta}>lastRawText: {data?.lastRawText || "-"}</Text>
        <Text style={styles.meta}>lastNormalizedState: {(data?.lastNormalizedState || "none").toUpperCase()}</Text>
        <Text style={styles.meta}>lastChangedAt: {data?.lastChangedAt || "-"}</Text>

        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.confirmButton, saving ? styles.disabled : null]}
            onPress={() => void setEnabled(true)}
            disabled={saving}
          >
            <Text style={styles.confirmText}>{saving ? "Saving..." : "Confirm"}</Text>
          </Pressable>
          <Pressable
            style={[styles.cancelButton, saving ? styles.disabled : null]}
            onPress={() => void setEnabled(false)}
            disabled={saving}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
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
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d8e4f0",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  title: { fontSize: 17, fontWeight: "800", color: "#123a5e" },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: "#123a5e" },
  meta: { fontSize: 12, color: "#315a7f" },
  buttonRow: { flexDirection: "row", gap: 8 },
  confirmButton: {
    flex: 1,
    backgroundColor: "#0f3b63",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  confirmText: { color: "#fff", fontWeight: "700" },
  cancelButton: {
    flex: 1,
    backgroundColor: "#f4f7fb",
    borderWidth: 1,
    borderColor: "#bfd3e7",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  cancelText: { color: "#123a5e", fontWeight: "700" },
  disabled: { opacity: 0.6 },
});
