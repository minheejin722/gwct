import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import type { ThemeMode } from "@gwct/shared";
import { useAppPreferences } from "../../lib/appPreferences";

const themeOptions: Array<{ mode: ThemeMode; title: string; subtitle: string }> = [
  { mode: "system", title: "System", subtitle: "Follow the phone appearance setting." },
  { mode: "dark", title: "Dark", subtitle: "Use the app dark palette." },
  { mode: "light", title: "Light", subtitle: "Use the standard light palette." },
];

export default function SettingsScreen() {
  const {
    alertsEnabled,
    bannerEnabled,
    themeMode,
    resolvedTheme,
    colors,
    isReady,
    syncError,
    setAlertsEnabled,
    setBannerEnabled,
    setThemeMode,
  } = useAppPreferences();
  const [savingKey, setSavingKey] = useState<"alerts" | "banner" | "theme" | null>(null);

  const styles = createStyles(colors);

  const updateAlerts = async (next: boolean) => {
    setSavingKey("alerts");
    try {
      await setAlertsEnabled(next);
    } catch (error) {
      Alert.alert("Save failed", `Could not update alert setting: ${(error as Error).message}`);
    } finally {
      setSavingKey(null);
    }
  };

  const updateBanner = async (next: boolean) => {
    setSavingKey("banner");
    try {
      await setBannerEnabled(next);
    } catch (error) {
      Alert.alert("Save failed", `Could not update banner setting: ${(error as Error).message}`);
    } finally {
      setSavingKey(null);
    }
  };

  const updateTheme = async (next: ThemeMode) => {
    if (themeMode === next) {
      return;
    }
    setSavingKey("theme");
    try {
      await setThemeMode(next);
    } catch (error) {
      Alert.alert("Save failed", `Could not update theme mode: ${(error as Error).message}`);
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>App Settings</Text>
        <Text style={styles.heroText}>
          Manage alert delivery, foreground banner behavior, and the app theme mode from this tab.
        </Text>
        <Text style={styles.heroMeta}>
          Current theme: <Text style={styles.heroMetaStrong}>{resolvedTheme}</Text>
        </Text>
        {!isReady ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={styles.loadingText}>Loading saved device settings…</Text>
          </View>
        ) : null}
        {syncError ? <Text style={styles.errorText}>Last sync error: {syncError}</Text> : null}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.settingRow}>
          <View style={styles.settingCopy}>
            <Text style={styles.settingLabel}>Alarm</Text>
            <Text style={styles.settingDescription}>Control push and local alert delivery for this device.</Text>
          </View>
          <View style={styles.controlCell}>
            {savingKey === "alerts" ? <ActivityIndicator size="small" color={colors.accent} /> : null}
            <Switch
              value={alertsEnabled}
              onValueChange={(next) => void updateAlerts(next)}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.surfaceBackground}
            />
          </View>
        </View>

        <View style={[styles.settingRow, !alertsEnabled ? styles.settingRowDisabled : null]}>
          <View style={styles.settingCopy}>
            <Text style={styles.settingLabel}>Banner</Text>
            <Text style={styles.settingDescription}>
              Show or hide the in-app notification banner while the app is open.
            </Text>
          </View>
          <View style={styles.controlCell}>
            {savingKey === "banner" ? <ActivityIndicator size="small" color={colors.accent} /> : null}
            <Switch
              value={bannerEnabled}
              onValueChange={(next) => void updateBanner(next)}
              disabled={!alertsEnabled}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.surfaceBackground}
            />
          </View>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Theme Mode</Text>
        <View style={styles.themeGrid}>
          {themeOptions.map((option) => {
            const selected = themeMode === option.mode;
            return (
              <Pressable
                key={option.mode}
                style={[styles.themeOption, selected ? styles.themeOptionSelected : null]}
                onPress={() => void updateTheme(option.mode)}
              >
                <Text style={[styles.themeTitle, selected ? styles.themeTitleSelected : null]}>{option.title}</Text>
                <Text style={[styles.themeSubtitle, selected ? styles.themeSubtitleSelected : null]}>
                  {option.subtitle}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {savingKey === "theme" ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={styles.loadingText}>Saving theme mode…</Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function createStyles(colors: ReturnType<typeof useAppPreferences>["colors"]) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.screenBackground },
    content: { padding: 16, gap: 14, paddingBottom: 28 },
    heroCard: {
      backgroundColor: colors.surfaceBackground,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 8,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 5,
      elevation: 2,
    },
    heroTitle: { fontSize: 22, fontWeight: "800", color: colors.primaryText },
    heroText: { fontSize: 14, lineHeight: 20, color: colors.secondaryText },
    heroMeta: { fontSize: 13, color: colors.secondaryText },
    heroMetaStrong: { color: colors.primaryText, fontWeight: "700" },
    sectionCard: {
      backgroundColor: colors.surfaceBackground,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 14,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 5,
      elevation: 2,
    },
    sectionTitle: { fontSize: 18, fontWeight: "800", color: colors.primaryText },
    settingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16,
    },
    settingRowDisabled: {
      opacity: 0.55,
    },
    settingCopy: {
      flex: 1,
      gap: 4,
    },
    settingLabel: { fontSize: 16, fontWeight: "700", color: colors.primaryText },
    settingDescription: { fontSize: 13, lineHeight: 18, color: colors.secondaryText },
    controlCell: {
      minWidth: 72,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 10,
    },
    themeGrid: {
      gap: 10,
    },
    themeOption: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.elevatedBackground,
      padding: 14,
      gap: 4,
    },
    themeOptionSelected: {
      borderColor: colors.accent,
      backgroundColor: colors.surfaceBackground,
    },
    themeTitle: { fontSize: 16, fontWeight: "700", color: colors.primaryText },
    themeTitleSelected: { color: colors.accent },
    themeSubtitle: { fontSize: 13, lineHeight: 18, color: colors.secondaryText },
    themeSubtitleSelected: { color: colors.primaryText },
    loadingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    loadingText: { fontSize: 13, color: colors.secondaryText },
    errorText: {
      color: colors.danger,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "600",
    },
  });
}
