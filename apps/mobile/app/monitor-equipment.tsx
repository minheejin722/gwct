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

interface EquipmentMonitorSaveResponse {
  yt: {
    enabled: boolean;
    threshold: number;
    stateInitialized: boolean;
    state: "NORMAL" | "LOW" | null;
  };
  gcStaff: {
    enabled: boolean;
  };
}

function clampThreshold(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, Math.trunc(parsed));
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatCapturedAt(value: string | null): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function saveEquipmentConfig(payload: Record<string, unknown>) {
  return fetchJson<EquipmentMonitorSaveResponse>(API_URLS.monitorEquipment, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function statusText(enabled: boolean): string {
  return enabled ? "ACTIVE" : "OFF";
}

export default function MonitorEquipmentScreen() {
  const { colors, resolvedTheme } = useAppPreferences();
  const styles = useMemo(() => createStyles(colors, resolvedTheme), [colors, resolvedTheme]);
  const { data, loading, error, refresh, setData } = useEndpoint<EquipmentMonitorResponse>(API_URLS.monitorEquipment);
  const scrollRef = useRef<ScrollView | null>(null);

  const [ytInput, setYtInput] = useState("25");
  const [savingYt, setSavingYt] = useState(false);
  const [savingGcStaff, setSavingGcStaff] = useState(false);

  useEffect(() => {
    if (!data) {
      return;
    }
    setYtInput(String(data.yt.threshold));
  }, [data]);

  const summary = useMemo(() => {
    const rows = data?.gcStates || [];
    return {
      cabinReady: rows.filter((row) => Boolean(row.driverName)).length,
      underReady: rows.filter((row) => Boolean(row.hkName)).length,
      stopFlagged: rows.filter((row) => Boolean(row.stopReason)).length,
    };
  }, [data?.gcStates]);
  useHeaderScrollToTop(["monitor-equipment"], scrollRef);

  const stepYt = (delta: number) => {
    const next = clampThreshold(Number(ytInput) + delta);
    setYtInput(String(next));
  };

  const onConfirmYt = async () => {
    const threshold = clampThreshold(ytInput);
    setSavingYt(true);
    try {
      const saved = await saveEquipmentConfig({
        yt: {
          enabled: true,
          threshold,
        },
      });
      setData((previous) =>
        previous
          ? { ...previous, ...saved }
          : { ...saved, latestCapturedAt: null, ytCount: 0, gcStates: [] },
      );
      void refresh({ silent: true });
    } catch (err) {
      Alert.alert("Save failed", (err as Error).message);
    } finally {
      setSavingYt(false);
    }
  };

  const onCancelYt = async () => {
    setSavingYt(true);
    try {
      const saved = await saveEquipmentConfig({
        yt: {
          enabled: false,
        },
      });
      setData((previous) =>
        previous
          ? { ...previous, ...saved }
          : { ...saved, latestCapturedAt: null, ytCount: 0, gcStates: [] },
      );
      void refresh({ silent: true });
    } catch (err) {
      Alert.alert("Save failed", (err as Error).message);
    } finally {
      setSavingYt(false);
    }
  };

  const setGcStaffEnabled = async (enabled: boolean) => {
    setSavingGcStaff(true);
    try {
      const saved = await saveEquipmentConfig({ gcStaff: { enabled } });
      setData((previous) =>
        previous
          ? { ...previous, ...saved }
          : { ...saved, latestCapturedAt: null, ytCount: 0, gcStates: [] },
      );
      void refresh({ silent: true });
    } catch (err) {
      Alert.alert("Save failed", (err as Error).message);
    } finally {
      setSavingGcStaff(false);
    }
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}
    >
      {error ? <Text style={styles.error}>Server connection failed, retrying...</Text> : null}

      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.heroTitleBlock}>
            <Text style={styles.heroEyebrow}>Monitoring</Text>
            <Text style={styles.heroTitle}>Equipment Monitor</Text>
          </View>
          <View style={styles.heroOrb} />
        </View>

        <View style={styles.heroChipRow}>
          <View style={styles.heroChip}>
            <Text style={styles.heroChipLabel}>Last captured</Text>
            <Text style={styles.heroChipValue}>{formatCapturedAt(data?.latestCapturedAt || null)}</Text>
          </View>
          <View style={styles.heroChip}>
            <Text style={styles.heroChipLabel}>YT live count</Text>
            <Text style={styles.heroChipValue}>{data?.ytCount ?? 0}</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleBlock}>
            <Text style={styles.sectionTitle}>YT Count Monitor</Text>
          </View>
          <View style={[styles.statusBadge, data?.yt.enabled ? styles.statusBadgeActive : styles.statusBadgeOff]}>
            <Text style={[styles.statusBadgeText, data?.yt.enabled ? styles.statusBadgeTextActive : styles.statusBadgeTextOff]}>
              {statusText(Boolean(data?.yt.enabled))}
            </Text>
          </View>
        </View>

        <View style={styles.metricStrip}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>State machine</Text>
            <Text style={styles.metricValue}>{data?.yt.state || "-"}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Threshold</Text>
            <Text style={styles.metricValue}>{clampThreshold(ytInput)}</Text>
          </View>
        </View>

        <View style={styles.stepShell}>
          <TactilePressable style={styles.stepButton} variant="compact" onPress={() => stepYt(-1)}>
            <Text style={styles.stepText}>-</Text>
          </TactilePressable>
          <TextInput
            style={styles.input}
            value={ytInput}
            onChangeText={(text) => setYtInput(sanitizeNumericInput(text))}
            keyboardType="default"
            returnKeyType="search"
            onSubmitEditing={() => void onConfirmYt()}
            autoCorrect={false}
            spellCheck={false}
          />
          <TactilePressable style={styles.stepButton} variant="compact" onPress={() => stepYt(1)}>
            <Text style={styles.stepText}>+</Text>
          </TactilePressable>
        </View>

        <View style={styles.buttonRow}>
          <TactilePressable
            style={[styles.confirmButton, savingYt ? styles.disabled : null]}
            onPress={() => void onConfirmYt()}
            disabled={savingYt}
          >
            <Text style={styles.confirmText}>{savingYt ? "Saving..." : "Confirm"}</Text>
          </TactilePressable>
          <TactilePressable
            style={[styles.cancelButton, savingYt ? styles.disabled : null]}
            onPress={() => void onCancelYt()}
            disabled={savingYt}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TactilePressable>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleBlock}>
            <Text style={styles.sectionTitle}>GC180~GC190 Cabin/Under Monitor</Text>
          </View>
          <View
            style={[styles.statusBadge, data?.gcStaff.enabled ? styles.statusBadgeActive : styles.statusBadgeOff]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                data?.gcStaff.enabled ? styles.statusBadgeTextActive : styles.statusBadgeTextOff,
              ]}
            >
              {statusText(Boolean(data?.gcStaff.enabled))}
            </Text>
          </View>
        </View>

        <View style={styles.metricStrip}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Cabin ready</Text>
            <Text style={styles.metricValue}>{summary.cabinReady}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Under ready</Text>
            <Text style={styles.metricValue}>{summary.underReady}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Stop flagged</Text>
            <Text style={styles.metricValue}>{summary.stopFlagged}</Text>
          </View>
        </View>

        <View style={styles.buttonRow}>
          <TactilePressable
            style={[styles.confirmButton, savingGcStaff ? styles.disabled : null]}
            onPress={() => void setGcStaffEnabled(true)}
            disabled={savingGcStaff}
          >
            <Text style={styles.confirmText}>{savingGcStaff ? "Saving..." : "Confirm"}</Text>
          </TactilePressable>
          <TactilePressable
            style={[styles.cancelButton, savingGcStaff ? styles.disabled : null]}
            onPress={() => void setGcStaffEnabled(false)}
            disabled={savingGcStaff}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TactilePressable>
        </View>
      </View>
    </ScrollView>
  );
}

function createStyles(colors: ReturnType<typeof useAppPreferences>["colors"], resolvedTheme: "light" | "dark") {
  const heroBackground = resolvedTheme === "dark" ? "#13202f" : "#0f3b63";
  const heroBorder = resolvedTheme === "dark" ? "#243548" : "#1b4e7a";
  const heroText = "#f4f8fc";
  const heroMuted = resolvedTheme === "dark" ? "#b8c6d5" : "#c8dcf0";
  const inputBackground = resolvedTheme === "dark" ? "#1c2630" : "#f8fbff";

  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.screenBackground },
    content: { padding: 16, gap: 14, paddingBottom: 28 },
    error: {
      backgroundColor: "#fde8e8",
      borderWidth: 1,
      borderColor: "#e8a8a8",
      color: "#8b1a1a",
      padding: 10,
      borderRadius: 10,
      fontWeight: "700",
    },
    heroCard: {
      backgroundColor: heroBackground,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: heroBorder,
      padding: 18,
      gap: 16,
      shadowColor: "#000000",
      shadowOpacity: resolvedTheme === "dark" ? 0.22 : 0.16,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 10 },
      elevation: 4,
    },
    heroHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
    },
    heroTitleBlock: {
      flex: 1,
      gap: 4,
    },
    heroEyebrow: {
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 1,
      textTransform: "uppercase",
      color: heroMuted,
    },
    heroTitle: {
      fontSize: 24,
      fontWeight: "900",
      color: heroText,
      lineHeight: 28,
    },
    heroOrb: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: "#6db6ff",
      opacity: 0.95,
      marginTop: 4,
    },
    heroChipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    heroChip: {
      minWidth: 98,
      flexGrow: 1,
      backgroundColor: "rgba(255,255,255,0.08)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.12)",
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 3,
    },
    heroChipLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: heroMuted,
    },
    heroChipValue: {
      fontSize: 18,
      fontWeight: "800",
      color: heroText,
    },
    card: {
      backgroundColor: colors.surfaceBackground,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      padding: 16,
      gap: 14,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
    },
    cardTitleBlock: {
      flex: 1,
      gap: 2,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.primaryText,
      lineHeight: 22,
    },
    statusBadge: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderWidth: 1,
    },
    statusBadgeActive: {
      backgroundColor: resolvedTheme === "dark" ? "rgba(128,213,143,0.12)" : "#e7f6eb",
      borderColor: resolvedTheme === "dark" ? "rgba(128,213,143,0.28)" : "#c6e8cd",
    },
    statusBadgeOff: {
      backgroundColor: resolvedTheme === "dark" ? "rgba(255,203,107,0.10)" : "#fff3df",
      borderColor: resolvedTheme === "dark" ? "rgba(255,203,107,0.24)" : "#f0ddbc",
    },
    statusBadgeText: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.6,
    },
    statusBadgeTextActive: {
      color: colors.success,
    },
    statusBadgeTextOff: {
      color: colors.warning,
    },
    metricStrip: {
      flexDirection: "row",
      gap: 10,
    },
    metricCard: {
      flex: 1,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.elevatedBackground,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 4,
    },
    metricLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.secondaryText,
    },
    metricValue: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.primaryText,
    },
    stepShell: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    stepButton: {
      width: 42,
      height: 42,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.elevatedBackground,
    },
    stepText: {
      fontSize: 20,
      fontWeight: "800",
      color: colors.primaryText,
    },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: inputBackground,
      fontSize: 18,
      fontWeight: "800",
      textAlign: "center",
      color: colors.primaryText,
    },
    buttonRow: {
      flexDirection: "row",
      gap: 10,
    },
    confirmButton: {
      flex: 1,
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
    },
    confirmText: {
      color: resolvedTheme === "dark" ? "#0e1620" : "#ffffff",
      fontWeight: "800",
    },
    cancelButton: {
      flex: 1,
      backgroundColor: colors.surfaceBackground,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
    },
    cancelText: {
      color: colors.primaryText,
      fontWeight: "800",
    },
    disabled: { opacity: 0.6 },
  });
}
