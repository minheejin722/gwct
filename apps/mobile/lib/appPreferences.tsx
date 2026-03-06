import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform, useColorScheme as useSystemColorScheme } from "react-native";
import type { ThemeMode } from "@gwct/shared";
import { API_URLS } from "./config";
import { configureNotificationPresentation, getExpoPushTokenSafe, localDeviceId } from "./push";

type ResolvedTheme = "light" | "dark";

interface ThemePalette {
  screenBackground: string;
  surfaceBackground: string;
  elevatedBackground: string;
  headerBackground: string;
  tabBackground: string;
  border: string;
  shadow: string;
  primaryText: string;
  secondaryText: string;
  accent: string;
  accentMuted: string;
  icon: string;
  danger: string;
  success: string;
  warning: string;
  badgeBackground: string;
}

interface DeviceSettingsResponse {
  deviceId: string;
  alertsEnabled: boolean;
  bannerEnabled: boolean;
  themeMode: ThemeMode;
}

interface AppPreferencesContextValue {
  alertsEnabled: boolean;
  bannerEnabled: boolean;
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  colors: ThemePalette;
  isReady: boolean;
  syncError: string | null;
  setAlertsEnabled(next: boolean): Promise<void>;
  setBannerEnabled(next: boolean): Promise<void>;
  setThemeMode(next: ThemeMode): Promise<void>;
}

const lightPalette: ThemePalette = {
  screenBackground: "#e2e6ea",
  surfaceBackground: "#ffffff",
  elevatedBackground: "#ecf0f3",
  headerBackground: "#f2f4f6",
  tabBackground: "#f2f4f6",
  border: "#c8d4df",
  shadow: "#000000",
  primaryText: "#1c2b36",
  secondaryText: "#5f7488",
  accent: "#0f3b63",
  accentMuted: "#123555",
  icon: "#123555",
  danger: "#d32f2f",
  success: "#2e7d32",
  warning: "#b26a00",
  badgeBackground: "#1976d2",
};

const darkPalette: ThemePalette = {
  screenBackground: "#161c22",
  surfaceBackground: "#202830",
  elevatedBackground: "#242d36",
  headerBackground: "#1a2027",
  tabBackground: "#1a2027",
  border: "#33404c",
  shadow: "#000000",
  primaryText: "#eef4fb",
  secondaryText: "#afbcc9",
  accent: "#d7e7fb",
  accentMuted: "#8fb8df",
  icon: "#8fb8df",
  danger: "#ff7a7a",
  success: "#80d58f",
  warning: "#ffcb6b",
  badgeBackground: "#2c7fe3",
};

const AppPreferencesContext = createContext<AppPreferencesContextValue | null>(null);

function resolveThemeMode(themeMode: ThemeMode, systemScheme: ResolvedTheme): ResolvedTheme {
  if (themeMode === "system") {
    return systemScheme;
  }
  return themeMode;
}

async function registerCurrentDevice(): Promise<DeviceSettingsResponse> {
  const expoPushToken = await getExpoPushTokenSafe();
  const response = await fetch(API_URLS.registerDevice, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      deviceId: localDeviceId(),
      platform: Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : "web",
      expoPushToken,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Seoul",
      appVersion: null,
      alertsEnabled: true,
      bannerEnabled: true,
      themeMode: "system",
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return (await response.json()) as DeviceSettingsResponse;
}

export function AppPreferencesProvider({ children }: { children: ReactNode }) {
  const systemScheme = useSystemColorScheme() === "dark" ? "dark" : "light";
  const [alertsEnabled, setAlertsEnabledState] = useState(true);
  const [bannerEnabled, setBannerEnabledState] = useState(true);
  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");
  const [isReady, setIsReady] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const resolvedTheme = resolveThemeMode(themeMode, systemScheme);
  const colors = resolvedTheme === "dark" ? darkPalette : lightPalette;

  useEffect(() => {
    configureNotificationPresentation({
      alertsEnabled,
      bannerEnabled,
    });
  }, [alertsEnabled, bannerEnabled]);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      try {
        const saved = await registerCurrentDevice();
        if (!active) {
          return;
        }
        setAlertsEnabledState(saved.alertsEnabled);
        setBannerEnabledState(saved.bannerEnabled);
        setThemeModeState(saved.themeMode);
        setSyncError(null);
      } catch (error) {
        if (!active) {
          return;
        }
        setSyncError((error as Error).message);
      } finally {
        if (active) {
          setIsReady(true);
        }
      }
    };

    void bootstrap();

    return () => {
      active = false;
    };
  }, []);

  const updateRemoteSettings = useCallback(
    async (patch: Partial<Pick<DeviceSettingsResponse, "alertsEnabled" | "bannerEnabled" | "themeMode">>) => {
      const previous = {
        alertsEnabled,
        bannerEnabled,
        themeMode,
      };

      if (typeof patch.alertsEnabled === "boolean") {
        setAlertsEnabledState(patch.alertsEnabled);
      }
      if (typeof patch.bannerEnabled === "boolean") {
        setBannerEnabledState(patch.bannerEnabled);
      }
      if (patch.themeMode) {
        setThemeModeState(patch.themeMode);
      }

      try {
        if (patch.alertsEnabled) {
          await registerCurrentDevice();
        }

        const response = await fetch(API_URLS.updateSettings(localDeviceId()), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const saved = (await response.json()) as Partial<DeviceSettingsResponse>;
        if (typeof saved.alertsEnabled === "boolean") {
          setAlertsEnabledState(saved.alertsEnabled);
        }
        if (typeof saved.bannerEnabled === "boolean") {
          setBannerEnabledState(saved.bannerEnabled);
        }
        if (saved.themeMode) {
          setThemeModeState(saved.themeMode);
        }
        setSyncError(null);
      } catch (error) {
        setAlertsEnabledState(previous.alertsEnabled);
        setBannerEnabledState(previous.bannerEnabled);
        setThemeModeState(previous.themeMode);
        setSyncError((error as Error).message);
        throw error;
      }
    },
    [alertsEnabled, bannerEnabled, themeMode],
  );

  const value = useMemo<AppPreferencesContextValue>(
    () => ({
      alertsEnabled,
      bannerEnabled,
      themeMode,
      resolvedTheme,
      colors,
      isReady,
      syncError,
      setAlertsEnabled: async (next: boolean) => {
        await updateRemoteSettings({ alertsEnabled: next });
      },
      setBannerEnabled: async (next: boolean) => {
        await updateRemoteSettings({ bannerEnabled: next });
      },
      setThemeMode: async (next: ThemeMode) => {
        await updateRemoteSettings({ themeMode: next });
      },
    }),
    [alertsEnabled, bannerEnabled, themeMode, resolvedTheme, colors, isReady, syncError, updateRemoteSettings],
  );

  return <AppPreferencesContext.Provider value={value}>{children}</AppPreferencesContext.Provider>;
}

export function useAppPreferences(): AppPreferencesContextValue {
  const value = useContext(AppPreferencesContext);
  if (!value) {
    throw new Error("useAppPreferences must be used inside AppPreferencesProvider");
  }
  return value;
}
