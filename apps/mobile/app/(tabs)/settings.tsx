import { useRef, useState } from "react";
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
import type { ThemeMode, YtMasterCallLiveState } from "@gwct/shared";
import { Link } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEndpoint } from "../../hooks/useEndpoint";
import { useHeaderScrollToTop } from "../../hooks/useHeaderScrollToTop";
import { useLocalDeviceId } from "../../hooks/useLocalDeviceId";
import { useAppPreferences } from "../../lib/appPreferences";
import { API_URLS } from "../../lib/config";

const themeOptions: Array<{ mode: ThemeMode; title: string; subtitle: string }> = [
  { mode: "system", title: "System", subtitle: "Follow the phone appearance setting." },
  { mode: "dark", title: "Dark", subtitle: "Use the app dark palette." },
  { mode: "light", title: "Light", subtitle: "Use the standard light palette." },
];

function formatRoleSummary(data: YtMasterCallLiveState | null): string {
  if (!data?.registration) {
    return "권한 미설정";
  }

  if (data.registration.role === "master") {
    return `${data.registration.masterSlot || "MASTER"} / ${data.registration.name}`;
  }

  return `${data.registration.ytNumber || "YT"} / ${data.registration.name}`;
}

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
  const { deviceId, isReady: deviceReady } = useLocalDeviceId();
  const [savingKey, setSavingKey] = useState<"alerts" | "banner" | "theme" | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const styles = createStyles(colors);

  const callLive = useEndpoint<YtMasterCallLiveState>(
    deviceId ? API_URLS.ytMasterCallLive(deviceId) : API_URLS.events,
    {
      immediate: Boolean(deviceId),
      liveEvents: deviceId ? ["yt_master_call_role_updated", "yt_master_call_changed"] : undefined,
    },
  );

  useHeaderScrollToTop(["settings"], scrollRef);

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

  const masterSlotsText = deviceReady
    ? `${callLive.data?.masterAssignments.length ?? 0}/2 slots in use`
    : "Loading device...";

  return (
    <ScrollView ref={scrollRef} style={styles.screen} contentContainerStyle={styles.content}>
      <Link href="/yt-master-call-settings" asChild>
        <Pressable style={styles.roleCard}>
          <View style={styles.roleIconWrap}>
            <MaterialCommunityIcons name="bullhorn" size={28} color={colors.surfaceBackground} />
          </View>
          <View style={styles.roleCopy}>
            <Text style={styles.roleTitle}>YT Master Call</Text>
            <Text style={styles.roleSubtitle}>반장 호출 권한을 설정하고 현재 사용자 역할을 관리합니다.</Text>
            <Text style={styles.roleMeta}>{formatRoleSummary(callLive.data)}</Text>
          </View>
          <View style={styles.roleAside}>
            {callLive.loading && deviceReady ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <MaterialCommunityIcons name="chevron-right" size={24} color={colors.secondaryText} />
            )}
            <Text style={styles.roleAsideText}>{masterSlotsText}</Text>
          </View>
        </Pressable>
      </Link>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          {!isReady ? <ActivityIndicator size="small" color={colors.accent} /> : null}
        </View>
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

        {syncError ? <Text style={styles.errorText}>Last sync error: {syncError}</Text> : null}
        {callLive.error && deviceReady ? <Text style={styles.errorText}>YT Master Call sync: {callLive.error}</Text> : null}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Theme Mode</Text>
        <Text style={styles.sectionMeta}>
          Current theme: <Text style={styles.sectionMetaStrong}>{resolvedTheme}</Text>
        </Text>
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
            <Text style={styles.loadingText}>Saving theme mode...</Text>
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
    roleCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      backgroundColor: colors.surfaceBackground,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 3,
    },
    roleIconWrap: {
      width: 52,
      height: 52,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.badgeBackground,
    },
    roleCopy: {
      flex: 1,
      gap: 3,
    },
    roleTitle: {
      fontSize: 21,
      fontWeight: "800",
      color: colors.primaryText,
    },
    roleSubtitle: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.secondaryText,
    },
    roleMeta: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.accent,
      marginTop: 3,
    },
    roleAside: {
      alignItems: "flex-end",
      justifyContent: "center",
      gap: 4,
    },
    roleAsideText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.secondaryText,
    },
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
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    sectionTitle: { fontSize: 18, fontWeight: "800", color: colors.primaryText },
    sectionMeta: { fontSize: 13, color: colors.secondaryText },
    sectionMetaStrong: { color: colors.primaryText, fontWeight: "700" },
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
