import { useEffect, useMemo, useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { TactilePressable } from "../components/TactilePressable";
import { useEndpoint } from "../hooks/useEndpoint";
import { useAppPreferences } from "../lib/appPreferences";
import { API_URLS } from "../lib/config";
import { sanitizeNumericInput } from "../lib/sanitizeNumericInput";

interface GwctEtaMonitorResponse {
  enabled: boolean;
  trackingCount: number;
  lastChangedAt: string | null;
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

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function rowColorLabel(rowColor: GwctEtaMonitorResponse["preview"][number]["rowColor"]): string {
  if (rowColor === "yellow") {
    return "Watch Start";
  }
  if (rowColor === "cyan") {
    return "Watch";
  }
  if (rowColor === "green") {
    return "Stable";
  }
  return "Unknown";
}

function rowColorTone(
  rowColor: GwctEtaMonitorResponse["preview"][number]["rowColor"],
  resolvedTheme: "light" | "dark",
  colors: ReturnType<typeof useAppPreferences>["colors"],
) {
  if (rowColor === "yellow") {
    return {
      strong: colors.warning,
      soft: resolvedTheme === "dark" ? "rgba(255,203,107,0.11)" : "#fff5df",
      border: resolvedTheme === "dark" ? "rgba(255,203,107,0.24)" : "#ead8a5",
    };
  }
  if (rowColor === "cyan") {
    return {
      strong: colors.badgeBackground,
      soft: resolvedTheme === "dark" ? "rgba(44,127,227,0.12)" : "#e8f1fd",
      border: resolvedTheme === "dark" ? "rgba(44,127,227,0.25)" : "#c3d9f8",
    };
  }
  if (rowColor === "green") {
    return {
      strong: colors.success,
      soft: resolvedTheme === "dark" ? "rgba(128,213,143,0.10)" : "#ebf7ee",
      border: resolvedTheme === "dark" ? "rgba(128,213,143,0.22)" : "#c8e5cf",
    };
  }
  return {
    strong: colors.secondaryText,
    soft: resolvedTheme === "dark" ? "rgba(175,188,201,0.10)" : "#eef3f7",
    border: resolvedTheme === "dark" ? "rgba(175,188,201,0.20)" : "#d3dde7",
  };
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
    pollMs: 5000,
    liveSources: ["gwct_schedule_list"],
  });
  const { colors, resolvedTheme } = useAppPreferences();
  const styles = useMemo(() => createStyles(colors, resolvedTheme), [colors, resolvedTheme]);

  const [countInput, setCountInput] = useState("11");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) {
      return;
    }
    setCountInput(String(data.trackingCount));
  }, [data]);

  const parsedCount = useMemo(() => clampTrackingCount(countInput), [countInput]);
  const previewItems = (data?.preview || []).slice(0, parsedCount);

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

      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={styles.heroTextBlock}>
            <Text style={styles.heroEyebrow}>Watch Window Tracking</Text>
            <Text style={styles.heroTitle}>GWCT ETA Monitor</Text>
            <View style={[styles.livePill, data?.enabled ? styles.livePillOn : styles.livePillOff]}>
              <Text style={[styles.livePillText, data?.enabled ? styles.livePillTextOn : styles.livePillTextOff]}>
                {data?.enabled ? "ACTIVE" : "OFF"}
              </Text>
            </View>
          </View>
          <View style={styles.heroIconBadge}>
            <MaterialCommunityIcons name="ferry" size={24} color="#f4f8fc" />
          </View>
        </View>

        <View style={styles.heroStatRow}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Last change</Text>
            <Text style={styles.heroStatValue}>{formatDateTime(data?.lastChangedAt || null)}</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Window size</Text>
            <Text style={styles.heroStatValue}>{parsedCount}</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Preview rows</Text>
            <Text style={styles.heroStatValue}>{previewItems.length}</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleBlock}>
            <Text style={styles.sectionTitle}>Watch Window Size</Text>
          </View>
          <View style={[styles.statusBadge, data?.enabled ? styles.statusBadgeOn : styles.statusBadgeOff]}>
            <Text style={[styles.statusBadgeText, data?.enabled ? styles.statusBadgeTextOn : styles.statusBadgeTextOff]}>
              {data?.enabled ? "ON" : "OFF"}
            </Text>
          </View>
        </View>

        <View style={styles.stepShell}>
          <TactilePressable style={styles.stepButton} variant="compact" onPress={() => step(-1)}>
            <Text style={styles.stepText}>-</Text>
          </TactilePressable>
          <TextInput
            style={styles.input}
            value={countInput}
            onChangeText={(text) => setCountInput(sanitizeNumericInput(text))}
            keyboardType="default"
            returnKeyType="search"
            onSubmitEditing={() => void onConfirm()}
            autoCorrect={false}
            spellCheck={false}
          />
          <TactilePressable style={styles.stepButton} variant="compact" onPress={() => step(1)}>
            <Text style={styles.stepText}>+</Text>
          </TactilePressable>
        </View>

        <View style={styles.buttonRow}>
          <TactilePressable
            style={[styles.primaryButton, saving ? styles.disabled : null]}
            onPress={() => void onConfirm()}
            disabled={saving}
          >
            <Text style={styles.primaryText}>{saving ? "Saving..." : "Enable"}</Text>
          </TactilePressable>
          <TactilePressable
            style={[styles.secondaryButton, saving ? styles.disabled : null]}
            onPress={() => void onCancel()}
            disabled={saving}
          >
            <Text style={styles.secondaryText}>Disable</Text>
          </TactilePressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Watch Window Preview</Text>
        {!previewItems.length ? (
          <Text style={styles.emptyText}>No watch-window rows are available yet.</Text>
        ) : (
          previewItems.map((item) => {
            const tone = rowColorTone(item.rowColor, resolvedTheme, colors);

            return (
              <View key={`${item.voyage}-${item.indexInWatchWindow}`} style={styles.previewCard}>
                <View style={styles.previewTop}>
                  <View style={styles.previewIndexBadge}>
                    <Text style={styles.previewIndexText}>{item.indexInWatchWindow}</Text>
                  </View>
                  <View style={styles.previewTitleBlock}>
                    <Text style={styles.previewVoyage}>{item.voyage}</Text>
                    <Text style={styles.previewVessel}>{item.vesselName}</Text>
                  </View>
                  <View style={[styles.previewTonePill, { backgroundColor: tone.soft, borderColor: tone.border }]}>
                    <Text style={[styles.previewToneText, { color: tone.strong }]}>{rowColorLabel(item.rowColor)}</Text>
                  </View>
                </View>

                <View style={styles.previewMetaRow}>
                  <Text style={styles.previewMetaLabel}>ETA</Text>
                  <Text style={styles.previewMetaValue}>{item.etaNormalized || "-"}</Text>
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

function createStyles(colors: ReturnType<typeof useAppPreferences>["colors"], resolvedTheme: "light" | "dark") {
  const heroBackground = resolvedTheme === "dark" ? "#142233" : "#103754";
  const heroBorder = resolvedTheme === "dark" ? "#27384d" : "#265273";
  const heroPrimary = "#f4f8fc";
  const heroSecondary = resolvedTheme === "dark" ? "#bcc8d5" : "#d3e0ec";
  const inputBackground = resolvedTheme === "dark" ? "#1b2631" : "#f8fbff";

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
      borderWidth: 1,
      borderColor: heroBorder,
      borderRadius: 24,
      padding: 18,
      gap: 16,
      shadowColor: "#000000",
      shadowOpacity: resolvedTheme === "dark" ? 0.22 : 0.15,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 10 },
      elevation: 4,
    },
    heroTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
    },
    heroTextBlock: {
      flex: 1,
      gap: 6,
    },
    heroEyebrow: {
      fontSize: 12,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 1,
      color: heroSecondary,
    },
    heroTitle: {
      fontSize: 24,
      lineHeight: 29,
      fontWeight: "900",
      color: heroPrimary,
    },
    livePill: {
      alignSelf: "flex-start",
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
      marginTop: 2,
    },
    livePillOn: {
      backgroundColor: "rgba(128,213,143,0.14)",
      borderColor: "rgba(128,213,143,0.28)",
    },
    livePillOff: {
      backgroundColor: "rgba(255,203,107,0.12)",
      borderColor: "rgba(255,203,107,0.25)",
    },
    livePillText: {
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0.6,
    },
    livePillTextOn: {
      color: "#9be2a7",
    },
    livePillTextOff: {
      color: "#ffd56f",
    },
    heroIconBadge: {
      width: 50,
      height: 50,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.15)",
      backgroundColor: "rgba(255,255,255,0.08)",
    },
    heroStatRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    heroStat: {
      minWidth: 96,
      flexGrow: 1,
      backgroundColor: "rgba(255,255,255,0.08)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.12)",
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 4,
    },
    heroStatLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: heroSecondary,
    },
    heroStatValue: {
      fontSize: 15,
      fontWeight: "800",
      color: heroPrimary,
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
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
    },
    cardTitleBlock: {
      flex: 1,
      gap: 2,
    },
    sectionTitle: {
      fontSize: 16,
      lineHeight: 22,
      fontWeight: "800",
      color: colors.primaryText,
    },
    statusBadge: {
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    statusBadgeOn: {
      backgroundColor: resolvedTheme === "dark" ? "rgba(128,213,143,0.12)" : "#eaf7ee",
      borderColor: resolvedTheme === "dark" ? "rgba(128,213,143,0.24)" : "#c8e5cf",
    },
    statusBadgeOff: {
      backgroundColor: resolvedTheme === "dark" ? "rgba(255,203,107,0.10)" : "#fff5df",
      borderColor: resolvedTheme === "dark" ? "rgba(255,203,107,0.24)" : "#ead8a5",
    },
    statusBadgeText: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.6,
    },
    statusBadgeTextOn: {
      color: colors.success,
    },
    statusBadgeTextOff: {
      color: colors.warning,
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
    primaryButton: {
      flex: 1,
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
    },
    primaryText: {
      color: resolvedTheme === "dark" ? "#0e1620" : "#ffffff",
      fontWeight: "800",
    },
    secondaryButton: {
      flex: 1,
      backgroundColor: colors.surfaceBackground,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
    },
    secondaryText: {
      color: colors.primaryText,
      fontWeight: "800",
    },
    previewCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      backgroundColor: colors.elevatedBackground,
      paddingHorizontal: 12,
      paddingVertical: 12,
      gap: 10,
    },
    previewTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    previewIndexBadge: {
      width: 30,
      height: 30,
      borderRadius: 10,
      backgroundColor: colors.surfaceBackground,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    previewIndexText: {
      fontSize: 13,
      fontWeight: "800",
      color: colors.primaryText,
    },
    previewTitleBlock: {
      flex: 1,
      gap: 2,
    },
    previewVoyage: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.primaryText,
    },
    previewVessel: {
      fontSize: 13,
      color: colors.secondaryText,
      lineHeight: 18,
    },
    previewTonePill: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 5,
    },
    previewToneText: {
      fontSize: 11,
      fontWeight: "800",
    },
    previewMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    previewMetaLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.secondaryText,
    },
    previewMetaValue: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.primaryText,
    },
    emptyText: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.secondaryText,
    },
    disabled: { opacity: 0.6 },
  });
}
