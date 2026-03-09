import { useMemo, useRef, useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { TactilePressable } from "../components/TactilePressable";
import { useEndpoint } from "../hooks/useEndpoint";
import { useHeaderScrollToTop } from "../hooks/useHeaderScrollToTop";
import { useAppPreferences } from "../lib/appPreferences";
import { API_URLS } from "../lib/config";
import { fetchJson } from "../lib/fetchJson";

interface YeosuMonitorResponse {
  enabled: boolean;
  lastRawText: string | null;
  lastNormalizedState: "none" | "partial" | "all" | null;
  lastChangedAt: string | null;
  latestCapturedAt: string | null;
  latestForecastState: "none" | "partial" | "all";
  latestDutyText: string | null;
}

interface YeosuMonitorSaveResponse {
  enabled: boolean;
  lastRawText: string | null;
  lastNormalizedState: "none" | "partial" | "all" | null;
  lastChangedAt: string | null;
}

type WeatherState = YeosuMonitorResponse["latestForecastState"];

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

function stateLabel(state: WeatherState | null): string {
  if (state === "all") {
    return "All Stop";
  }
  if (state === "partial") {
    return "Partial Hold";
  }
  return "Normal Service";
}

function stateIcon(state: WeatherState | null): keyof typeof MaterialCommunityIcons.glyphMap {
  if (state === "all") {
    return "close-octagon-outline";
  }
  if (state === "partial") {
    return "alert-circle-outline";
  }
  return "check-circle-outline";
}

function stateTone(
  state: WeatherState | null,
  resolvedTheme: "light" | "dark",
  colors: ReturnType<typeof useAppPreferences>["colors"],
) {
  if (state === "all") {
    return {
      strong: colors.danger,
      soft: resolvedTheme === "dark" ? "rgba(255,122,122,0.12)" : "#fde8e8",
      border: resolvedTheme === "dark" ? "rgba(255,122,122,0.26)" : "#efb9b9",
    };
  }

  if (state === "partial") {
    return {
      strong: colors.warning,
      soft: resolvedTheme === "dark" ? "rgba(255,203,107,0.11)" : "#fff5df",
      border: resolvedTheme === "dark" ? "rgba(255,203,107,0.24)" : "#edd9ac",
    };
  }

  return {
    strong: colors.success,
    soft: resolvedTheme === "dark" ? "rgba(128,213,143,0.11)" : "#ebf7ee",
    border: resolvedTheme === "dark" ? "rgba(128,213,143,0.25)" : "#c9e5cf",
  };
}

async function saveYeosuConfig(payload: Record<string, unknown>) {
  return fetchJson<YeosuMonitorSaveResponse>(API_URLS.monitorYeosu, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export default function MonitorYeosuScreen() {
  const { data, loading, error, refresh, setData } = useEndpoint<YeosuMonitorResponse>(API_URLS.monitorYeosu);
  const { colors, resolvedTheme } = useAppPreferences();
  const styles = useMemo(() => createStyles(colors, resolvedTheme), [colors, resolvedTheme]);
  const scrollRef = useRef<ScrollView | null>(null);
  const [saving, setSaving] = useState(false);

  const liveState = data?.latestForecastState || "none";
  const liveTone = stateTone(liveState, resolvedTheme, colors);
  useHeaderScrollToTop(["monitor-yeosu"], scrollRef);

  const setEnabled = async (enabled: boolean) => {
    setSaving(true);
    try {
      const saved = await saveYeosuConfig({ enabled });
      setData((previous) =>
        previous
          ? { ...previous, ...saved }
          : {
              ...saved,
              latestCapturedAt: null,
              latestForecastState: "none",
              latestDutyText: null,
            },
      );
      void refresh({ silent: true });
    } catch (err) {
      Alert.alert("Save failed", (err as Error).message);
    } finally {
      setSaving(false);
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
        <View style={styles.heroTop}>
          <View style={styles.heroTextBlock}>
            <Text style={styles.heroEyebrow}>Pilotage Weather Watch</Text>
            <Text style={styles.heroTitle}>Yeosu Pilotage Monitor</Text>
            <View style={[styles.livePill, { backgroundColor: liveTone.soft, borderColor: liveTone.border }]}>
              <MaterialCommunityIcons name={stateIcon(liveState)} size={16} color={liveTone.strong} />
              <Text style={[styles.livePillText, { color: liveTone.strong }]}>{stateLabel(liveState)}</Text>
            </View>
          </View>
          <View style={[styles.heroBadge, { backgroundColor: liveTone.soft, borderColor: liveTone.border }]}>
            <MaterialCommunityIcons name="weather-windy" size={22} color={liveTone.strong} />
          </View>
        </View>

        <View style={styles.heroStatRow}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Monitor</Text>
            <Text style={styles.heroStatValue}>{data?.enabled ? "ACTIVE" : "OFF"}</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Last change</Text>
            <Text style={styles.heroStatValue}>{formatDateTime(data?.lastChangedAt || null)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Signal Text</Text>
        <View style={styles.textBlock}>
          <Text style={styles.textLabel}>Live Duty Text</Text>
          <Text style={styles.textValue}>{data?.latestDutyText || "No live duty text detected."}</Text>
        </View>
        <View style={styles.textBlock}>
          <Text style={styles.textLabel}>Stored Memory Text</Text>
          <Text style={styles.textValue}>{data?.lastRawText || "No stored signal text yet."}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.controlHeader}>
          <Text style={styles.sectionTitle}>Monitor Switch</Text>
          <View
            style={[
              styles.statusBadge,
              data?.enabled ? styles.statusBadgeActive : styles.statusBadgeOff,
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                data?.enabled ? styles.statusBadgeTextActive : styles.statusBadgeTextOff,
              ]}
            >
              {data?.enabled ? "ACTIVE" : "OFF"}
            </Text>
          </View>
        </View>

        <View style={styles.buttonRow}>
          <TactilePressable
            style={[styles.primaryButton, saving ? styles.disabled : null]}
            onPress={() => void setEnabled(true)}
            disabled={saving}
          >
            <Text style={styles.primaryText}>{saving ? "Saving..." : "Enable"}</Text>
          </TactilePressable>
          <TactilePressable
            style={[styles.secondaryButton, saving ? styles.disabled : null]}
            onPress={() => void setEnabled(false)}
            disabled={saving}
          >
            <Text style={styles.secondaryText}>Disable</Text>
          </TactilePressable>
        </View>
      </View>
    </ScrollView>
  );
}

function createStyles(colors: ReturnType<typeof useAppPreferences>["colors"], resolvedTheme: "light" | "dark") {
  const heroBackground = resolvedTheme === "dark" ? "#1a2130" : "#112d46";
  const heroBorder = resolvedTheme === "dark" ? "#2f3d50" : "#254b6d";
  const heroPrimary = "#f4f8fc";
  const heroSecondary = resolvedTheme === "dark" ? "#b9c4d1" : "#d7e3ef";
  const cardBackground = colors.surfaceBackground;
  const quoteBackground = resolvedTheme === "dark" ? "#1b2430" : "#f7fafc";

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
      shadowOpacity: resolvedTheme === "dark" ? 0.22 : 0.14,
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
      fontSize: 25,
      lineHeight: 30,
      fontWeight: "900",
      color: heroPrimary,
    },
    livePill: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
      marginTop: 2,
    },
    livePillText: {
      fontSize: 12,
      fontWeight: "800",
    },
    heroBadge: {
      width: 50,
      height: 50,
      borderRadius: 16,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
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
      backgroundColor: cardBackground,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      padding: 16,
      gap: 14,
    },
    sectionTitle: {
      fontSize: 16,
      lineHeight: 22,
      fontWeight: "800",
      color: colors.primaryText,
    },
    textBlock: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      backgroundColor: quoteBackground,
      paddingHorizontal: 12,
      paddingVertical: 12,
      gap: 6,
    },
    textLabel: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.secondaryText,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    textValue: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "600",
      color: colors.primaryText,
    },
    controlHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    statusBadge: {
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    statusBadgeActive: {
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
    statusBadgeTextActive: {
      color: colors.success,
    },
    statusBadgeTextOff: {
      color: colors.warning,
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
    disabled: { opacity: 0.6 },
  });
}
