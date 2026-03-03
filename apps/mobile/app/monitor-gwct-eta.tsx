import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useEndpoint } from "../hooks/useEndpoint";
import { API_URLS } from "../lib/config";

interface GwctEtaMonitorResponse {
  enabled: boolean;
  trackingCount: number;
  latestCapturedAt: string | null;
  preview: Array<{
    indexInWatchWindow: number;
    voyage: string;
    vesselName: string;
    etaNormalized: string | null;
    rowColor: "green" | "yellow" | "cyan" | "unknown";
  }>;
}

function clampTrackingCount(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  return Math.min(11, Math.max(1, Math.trunc(parsed)));
}

async function saveGwctEtaConfig(payload: Record<string, unknown>) {
  const response = await fetch(API_URLS.monitorGwctEta, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

export default function MonitorGwctEtaScreen() {
  const { data, loading, error, refresh } = useEndpoint<GwctEtaMonitorResponse>(API_URLS.monitorGwctEta, {
    pollMs: 25000,
  });

  const [countInput, setCountInput] = useState("11");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) {
      return;
    }
    setCountInput(String(data.trackingCount));
  }, [data]);

  const parsedCount = useMemo(() => clampTrackingCount(countInput), [countInput]);

  const step = (delta: number) => {
    const next = clampTrackingCount(Number(countInput) + delta);
    setCountInput(String(next));
  };

  const onConfirm = async () => {
    setSaving(true);
    try {
      await saveGwctEtaConfig({
        enabled: true,
        trackingCount: parsedCount,
      });
      await refresh();
      Alert.alert("Saved", "GWCT ETA monitor is now enabled.");
    } catch (err) {
      Alert.alert("Save failed", (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const onCancel = async () => {
    setSaving(true);
    try {
      await saveGwctEtaConfig({ enabled: false });
      await refresh();
      Alert.alert("Disabled", "GWCT ETA monitor is now disabled.");
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
        <Text style={styles.title}>GWCT ETA Monitor</Text>
        <Text style={styles.meta}>Status: {data?.enabled ? "ACTIVE" : "INACTIVE"}</Text>
        <Text style={styles.meta}>Last captured: {data?.latestCapturedAt || "-"}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Tracking vessel count N (1~11)</Text>
        <View style={styles.stepRow}>
          <Pressable style={styles.stepButton} onPress={() => step(-1)}>
            <Text style={styles.stepText}>-</Text>
          </Pressable>
          <TextInput style={styles.input} value={countInput} onChangeText={setCountInput} keyboardType="number-pad" />
          <Pressable style={styles.stepButton} onPress={() => step(1)}>
            <Text style={styles.stepText}>+</Text>
          </Pressable>
        </View>
        <Text style={styles.meta}>Applied value: {parsedCount}</Text>

        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.confirmButton, saving ? styles.disabled : null]}
            onPress={() => void onConfirm()}
            disabled={saving}
          >
            <Text style={styles.confirmText}>{saving ? "Saving..." : "Confirm"}</Text>
          </Pressable>
          <Pressable
            style={[styles.cancelButton, saving ? styles.disabled : null]}
            onPress={() => void onCancel()}
            disabled={saving}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Current Watch Window Preview</Text>
        {(data?.preview || []).slice(0, parsedCount).map((item) => (
          <Text key={`${item.voyage}-${item.indexInWatchWindow}`} style={styles.previewRow}>
            {item.indexInWatchWindow}) {item.voyage} {item.vesselName} ETA={item.etaNormalized || "-"}
          </Text>
        ))}
        {!data?.preview?.length ? <Text style={styles.previewRow}>No rows available yet.</Text> : null}
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
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d8e4f0",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  title: { fontSize: 17, fontWeight: "800", color: "#123a5e" },
  label: { fontSize: 14, fontWeight: "700", color: "#123a5e" },
  meta: { fontSize: 12, color: "#325a7f" },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepButton: {
    width: 38,
    height: 38,
    borderWidth: 1,
    borderColor: "#bfd3e7",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f7fbff",
  },
  stepText: { fontSize: 18, fontWeight: "800", color: "#123a5e" },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#c4d5e7",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#f9fbff",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    color: "#123a5e",
  },
  buttonRow: { flexDirection: "row", gap: 8 },
  confirmButton: {
    flex: 1,
    backgroundColor: "#0f3b63",
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  confirmText: { color: "#fff", fontWeight: "700" },
  cancelButton: {
    flex: 1,
    backgroundColor: "#f4f7fb",
    borderWidth: 1,
    borderColor: "#bfd3e7",
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  cancelText: { color: "#123a5e", fontWeight: "700" },
  disabled: { opacity: 0.6 },
  previewRow: { fontSize: 12, color: "#2b5377" },
});
