import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { TactilePressable } from "../components/TactilePressable";
import { useEndpoint } from "../hooks/useEndpoint";
import { useHeaderScrollToTop } from "../hooks/useHeaderScrollToTop";
import { useAppPreferences } from "../lib/appPreferences";
import { API_URLS } from "../lib/config";
import { fetchJson } from "../lib/fetchJson";
import { sanitizeNumericInput } from "../lib/sanitizeNumericInput";

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

type GcRemainingMonitorsPayload = Record<string, { enabled: boolean; threshold: number }>;

function clampThreshold(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, Math.trunc(parsed));
}

async function saveGcRule(gc: number, payload: { enabled?: boolean; threshold?: number }) {
  return fetchJson<GcRemainingMonitorsPayload>(API_URLS.monitorGcRemaining, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      gcRemainingMonitors: {
        [String(gc)]: payload,
      },
    }),
  });
}

export default function MonitorGcRemainingScreen() {
  const { colors, resolvedTheme } = useAppPreferences();
  const styles = useMemo(() => createStyles(colors, resolvedTheme), [colors, resolvedTheme]);
  const { data, loading, error, refresh, setData } = useEndpoint<GcRemainingMonitorResponse>(API_URLS.monitorGcRemaining);
  const scrollRef = useRef<ScrollView | null>(null);

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
  useHeaderScrollToTop(["monitor-gc-remaining"], scrollRef);

  const updateInput = (gc: number, text: string) => {
    setThresholdInputs((prev) => ({
      ...prev,
      [String(gc)]: sanitizeNumericInput(text),
    }));
  };

  const step = (gc: number, delta: number) => {
    const key = String(gc);
    const current = clampThreshold(thresholdInputs[key]);
    updateInput(gc, String(clampThreshold(current + delta)));
  };

  const withSaving = async <T,>(gc: number, fn: () => Promise<T>): Promise<T> => {
    const key = String(gc);
    setSavingGc((prev) => ({ ...prev, [key]: true }));
    try {
      return await fn();
    } finally {
      setSavingGc((prev) => ({ ...prev, [key]: false }));
    }
  };

  const onConfirm = async (gc: number) => {
    const key = String(gc);
    const threshold = clampThreshold(thresholdInputs[key]);
    try {
      const saved = await withSaving(gc, async () => {
        return saveGcRule(gc, {
          enabled: true,
          threshold,
        });
      });
      setData((previous) =>
        previous
          ? { ...previous, monitors: saved }
          : { monitors: saved, latestCapturedAt: null, latestItems: [] },
      );
      void refresh({ silent: true });
    } catch (err) {
      Alert.alert(`GC${gc} save failed`, (err as Error).message);
    }
  };

  const onCancel = async (gc: number) => {
    try {
      const saved = await withSaving(gc, async () => {
        return saveGcRule(gc, { enabled: false });
      });
      setData((previous) =>
        previous
          ? { ...previous, monitors: saved }
          : { monitors: saved, latestCapturedAt: null, latestItems: [] },
      );
      void refresh({ silent: true });
    } catch (err) {
      Alert.alert(`GC${gc} save failed`, (err as Error).message);
    }
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => void refresh()}
          tintColor={colors.accentMuted}
          colors={[colors.badgeBackground]}
        />
      }
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
            <Text style={[styles.meta, monitor.enabled ? styles.statusActive : styles.statusInactive]}>
              Status: {monitor.enabled ? "ACTIVE" : "INACTIVE"}
            </Text>
            <Text style={styles.meta}>
              Latest subtotal {latest?.remainingSubtotal ?? "-"} (Discharge {latest?.dischargeRemaining ?? "-"} / Load{" "}
              {latest?.loadRemaining ?? "-"})
            </Text>

            <View style={styles.stepRow}>
              <TactilePressable style={styles.stepButton} variant="compact" onPress={() => step(gc, -1)}>
                <Text style={styles.stepText}>-</Text>
              </TactilePressable>
              <TextInput
                style={styles.input}
                value={thresholdInputs[key] ?? String(monitor.threshold)}
                onChangeText={(text) => updateInput(gc, text)}
                keyboardType="default"
                returnKeyType="search"
                onSubmitEditing={() => void onConfirm(gc)}
                autoCorrect={false}
                spellCheck={false}
                selectionColor={colors.badgeBackground}
              />
              <TactilePressable style={styles.stepButton} variant="compact" onPress={() => step(gc, 1)}>
                <Text style={styles.stepText}>+</Text>
              </TactilePressable>
            </View>

            <View style={styles.buttonRow}>
              <TactilePressable
                style={[styles.confirmButton, saving ? styles.disabled : null]}
                onPress={() => void onConfirm(gc)}
                disabled={saving}
              >
                <Text style={styles.confirmText}>{saving ? "Saving..." : "Confirm"}</Text>
              </TactilePressable>
              <TactilePressable
                style={[styles.cancelButton, saving ? styles.disabled : null]}
                onPress={() => void onCancel(gc)}
                disabled={saving}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TactilePressable>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

function createStyles(colors: ReturnType<typeof useAppPreferences>["colors"], resolvedTheme: "light" | "dark") {
  const inputBackground = resolvedTheme === "dark" ? "#1b2631" : "#f9fbff";
  const stepBackground = resolvedTheme === "dark" ? "#1b2631" : "#f7fbff";
  const confirmBackground = resolvedTheme === "dark" ? colors.badgeBackground : "#0f3b63";

  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.screenBackground },
    content: { padding: 16, gap: 10, paddingBottom: 28 },
    error: {
      backgroundColor: resolvedTheme === "dark" ? "rgba(255,122,122,0.12)" : "#fde8e8",
      borderWidth: 1,
      borderColor: resolvedTheme === "dark" ? "rgba(255,122,122,0.26)" : "#e8a8a8",
      color: colors.danger,
      padding: 10,
      borderRadius: 10,
      fontWeight: "700",
    },
    headerCard: {
      backgroundColor: colors.surfaceBackground,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      gap: 4,
    },
    title: { fontSize: 17, fontWeight: "800", color: colors.primaryText },
    gcTitle: { fontSize: 16, fontWeight: "800", color: colors.primaryText },
    meta: { fontSize: 12, color: colors.secondaryText },
    statusActive: { color: colors.success },
    statusInactive: { color: colors.warning },
    card: {
      backgroundColor: colors.surfaceBackground,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      gap: 8,
    },
    stepRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    stepButton: {
      width: 38,
      height: 38,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: stepBackground,
    },
    stepText: { fontSize: 18, fontWeight: "800", color: colors.primaryText },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      backgroundColor: inputBackground,
      fontSize: 16,
      fontWeight: "700",
      textAlign: "center",
      color: colors.primaryText,
    },
    buttonRow: { flexDirection: "row", gap: 8 },
    confirmButton: {
      flex: 1,
      backgroundColor: confirmBackground,
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: "center",
    },
    confirmText: { color: "#ffffff", fontWeight: "700" },
    cancelButton: {
      flex: 1,
      backgroundColor: colors.elevatedBackground,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: "center",
    },
    cancelText: { color: colors.primaryText, fontWeight: "700" },
    disabled: { opacity: 0.6 },
  });
}
