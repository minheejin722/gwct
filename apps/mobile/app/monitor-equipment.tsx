import { useEffect, useState } from "react";
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

interface EquipmentMonitorResponse {
  yt: {
    enabled: boolean;
    threshold: number;
    stateInitialized: boolean;
    state: "NORMAL" | "LOW" | null;
  };
  gcStaff: {
    enabled: boolean;
  };
  latestCapturedAt: string | null;
  ytCount: number;
  gcStates: Array<{
    gcNo: number;
    driverName: string | null;
    hkName: string | null;
    loginTime: string | null;
    stopReason: string | null;
  }>;
}

function clampThreshold(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, Math.trunc(parsed));
}

async function saveEquipmentConfig(payload: Record<string, unknown>) {
  const response = await fetch(API_URLS.monitorEquipment, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

export default function MonitorEquipmentScreen() {
  const { data, loading, error, refresh } = useEndpoint<EquipmentMonitorResponse>(API_URLS.monitorEquipment, {
    pollMs: 25000,
  });

  const [ytInput, setYtInput] = useState("25");
  const [savingYt, setSavingYt] = useState(false);
  const [savingGcStaff, setSavingGcStaff] = useState(false);

  useEffect(() => {
    if (!data) {
      return;
    }
    setYtInput(String(data.yt.threshold));
  }, [data]);

  const stepYt = (delta: number) => {
    const next = clampThreshold(Number(ytInput) + delta);
    setYtInput(String(next));
  };

  const onConfirmYt = async () => {
    const threshold = clampThreshold(ytInput);
    setSavingYt(true);
    try {
      await saveEquipmentConfig({
        yt: {
          enabled: true,
          threshold,
        },
      });
      await refresh();
      Alert.alert("Saved", "YT count monitor is now enabled.");
    } catch (err) {
      Alert.alert("Save failed", (err as Error).message);
    } finally {
      setSavingYt(false);
    }
  };

  const onCancelYt = async () => {
    setSavingYt(true);
    try {
      await saveEquipmentConfig({
        yt: {
          enabled: false,
        },
      });
      await refresh();
      Alert.alert("Disabled", "YT count monitor is now disabled.");
    } catch (err) {
      Alert.alert("Save failed", (err as Error).message);
    } finally {
      setSavingYt(false);
    }
  };

  const setGcStaffEnabled = async (enabled: boolean) => {
    setSavingGcStaff(true);
    try {
      await saveEquipmentConfig({ gcStaff: { enabled } });
      await refresh();
      Alert.alert("Saved", `GC driver/HK monitor is now ${enabled ? "enabled" : "disabled"}.`);
    } catch (err) {
      Alert.alert("Save failed", (err as Error).message);
    } finally {
      setSavingGcStaff(false);
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
        <Text style={styles.title}>Equipment Monitor</Text>
        <Text style={styles.meta}>Last captured: {data?.latestCapturedAt || "-"}</Text>
        <Text style={styles.meta}>Current YT login count: {data?.ytCount ?? 0}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>YT Count Monitor</Text>
        <Text style={styles.meta}>Status: {data?.yt.enabled ? "ACTIVE" : "INACTIVE"}</Text>
        <Text style={styles.meta}>State machine: {data?.yt.state || "-"}</Text>
        <View style={styles.stepRow}>
          <Pressable style={styles.stepButton} onPress={() => stepYt(-1)}>
            <Text style={styles.stepText}>-</Text>
          </Pressable>
          <TextInput style={styles.input} value={ytInput} onChangeText={setYtInput} keyboardType="number-pad" />
          <Pressable style={styles.stepButton} onPress={() => stepYt(1)}>
            <Text style={styles.stepText}>+</Text>
          </Pressable>
        </View>
        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.confirmButton, savingYt ? styles.disabled : null]}
            onPress={() => void onConfirmYt()}
            disabled={savingYt}
          >
            <Text style={styles.confirmText}>{savingYt ? "Saving..." : "Confirm"}</Text>
          </Pressable>
          <Pressable
            style={[styles.cancelButton, savingYt ? styles.disabled : null]}
            onPress={() => void onCancelYt()}
            disabled={savingYt}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>GC180~GC190 Driver/HK Monitor</Text>
        <Text style={styles.meta}>Status: {data?.gcStaff.enabled ? "ACTIVE" : "INACTIVE"}</Text>
        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.confirmButton, savingGcStaff ? styles.disabled : null]}
            onPress={() => void setGcStaffEnabled(true)}
            disabled={savingGcStaff}
          >
            <Text style={styles.confirmText}>{savingGcStaff ? "Saving..." : "Confirm"}</Text>
          </Pressable>
          <Pressable
            style={[styles.cancelButton, savingGcStaff ? styles.disabled : null]}
            onPress={() => void setGcStaffEnabled(false)}
            disabled={savingGcStaff}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Latest GC180~190 State</Text>
        {(data?.gcStates || []).map((row) => (
          <Text key={row.gcNo} style={styles.row}>
            GC{row.gcNo} Driver={row.driverName || "-"} HK={row.hkName || "-"} Login={row.loginTime || "-"} Stop={row.stopReason || "-"}
          </Text>
        ))}
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
  row: { fontSize: 12, color: "#2b5377" },
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
