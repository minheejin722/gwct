import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useEndpoint } from "../hooks/useEndpoint";
import { API_URLS } from "../lib/config";

interface GcRemainingMonitorResponse {
  monitors: Record<string, { enabled: boolean; threshold: number }>;
  latestCapturedAt: string | null;
  latestItems: Array<{
    gc: number;
    dischargeRemaining: number | null;
    loadRemaining: number | null;
    remainingSubtotal: number | null;
  }>;
}

function clampThreshold(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, Math.trunc(parsed));
}

async function saveGcRule(gc: number, payload: { enabled?: boolean; threshold?: number }) {
  const response = await fetch(API_URLS.monitorGcRemaining, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      gcRemainingMonitors: {
        [String(gc)]: payload,
      },
    }),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

export default function MonitorGcRemainingScreen() {
  const { data, loading, error, refresh } = useEndpoint<GcRemainingMonitorResponse>(API_URLS.monitorGcRemaining, {
    pollMs: 25000,
  });

  const [thresholdInputs, setThresholdInputs] = useState<Record<string, string>>({});
  const [savingGc, setSavingGc] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!data?.monitors) {
      return;
    }
    const nextInputs: Record<string, string> = {};
    for (let gc = 181; gc <= 190; gc += 1) {
      const key = String(gc);
      nextInputs[key] = String(data.monitors[key]?.threshold ?? 0);
    }
    setThresholdInputs(nextInputs);
  }, [data?.monitors]);

  const latestByGc = useMemo(() => {
    const map = new Map<number, GcRemainingMonitorResponse["latestItems"][number]>();
    for (const row of data?.latestItems || []) {
      map.set(row.gc, row);
    }
    return map;
  }, [data?.latestItems]);

  const updateInput = (gc: number, text: string) => {
    setThresholdInputs((prev) => ({
      ...prev,
      [String(gc)]: text,
    }));
  };

  const step = (gc: number, delta: number) => {
    const key = String(gc);
    const current = clampThreshold(thresholdInputs[key]);
    updateInput(gc, String(clampThreshold(current + delta)));
  };

  const withSaving = async (gc: number, fn: () => Promise<void>) => {
    const key = String(gc);
    setSavingGc((prev) => ({ ...prev, [key]: true }));
    try {
      await fn();
      await refresh();
    } finally {
      setSavingGc((prev) => ({ ...prev, [key]: false }));
    }
  };

  const onConfirm = async (gc: number) => {
    const key = String(gc);
    const threshold = clampThreshold(thresholdInputs[key]);
    try {
      await withSaving(gc, async () => {
        await saveGcRule(gc, {
          enabled: true,
          threshold,
        });
      });
    } catch (err) {
      Alert.alert(`GC${gc} save failed`, (err as Error).message);
    }
  };

  const onCancel = async (gc: number) => {
    try {
      await withSaving(gc, async () => {
        await saveGcRule(gc, { enabled: false });
      });
    } catch (err) {
      Alert.alert(`GC${gc} save failed`, (err as Error).message);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}
    >
      {error ? <Text style={styles.error}>Server connection failed, retrying...</Text> : null}
      <View style={styles.headerCard}>
        <Text style={styles.title}>G/C Remaining Subtotal</Text>
        <Text style={styles.meta}>Last captured: {data?.latestCapturedAt || "-"}</Text>
      </View>

      {Array.from({ length: 10 }, (_, i) => 181 + i).map((gc) => {
        const key = String(gc);
        const monitor = data?.monitors?.[key] || { enabled: false, threshold: 0 };
        const latest = latestByGc.get(gc);
        const saving = Boolean(savingGc[key]);
        return (
          <View key={gc} style={styles.card}>
            <Text style={styles.gcTitle}>GC{gc}</Text>
            <Text style={styles.meta}>Status: {monitor.enabled ? "ACTIVE" : "INACTIVE"}</Text>
            <Text style={styles.meta}>
              Latest subtotal {latest?.remainingSubtotal ?? "-"} (Discharge {latest?.dischargeRemaining ?? "-"} / Load {latest?.loadRemaining ?? "-"})
            </Text>

            <View style={styles.stepRow}>
              <Pressable style={styles.stepButton} onPress={() => step(gc, -1)}>
                <Text style={styles.stepText}>-</Text>
              </Pressable>
              <TextInput
                style={styles.input}
                value={thresholdInputs[key] ?? String(monitor.threshold)}
                onChangeText={(text) => updateInput(gc, text)}
                keyboardType="number-pad"
              />
              <Pressable style={styles.stepButton} onPress={() => step(gc, 1)}>
                <Text style={styles.stepText}>+</Text>
              </Pressable>
            </View>

            <View style={styles.buttonRow}>
              <Pressable
                style={[styles.confirmButton, saving ? styles.disabled : null]}
                onPress={() => void onConfirm(gc)}
                disabled={saving}
              >
                <Text style={styles.confirmText}>{saving ? "Saving..." : "Confirm"}</Text>
              </Pressable>
              <Pressable
                style={[styles.cancelButton, saving ? styles.disabled : null]}
                onPress={() => void onCancel(gc)}
                disabled={saving}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
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
  headerCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d8e4f0",
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  title: { fontSize: 17, fontWeight: "800", color: "#123a5e" },
  gcTitle: { fontSize: 16, fontWeight: "800", color: "#123a5e" },
  meta: { fontSize: 12, color: "#315a7f" },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d8e4f0",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
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
