import { Stack, router } from "expo-router";
import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { Platform, Pressable } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import EventSource from "react-native-sse";
import { HeaderScrollTitle } from "../components/HeaderScrollTitle";
import { AppPreferencesProvider, useAppPreferences } from "../lib/appPreferences";
import { API_URLS } from "../lib/config";
import { resolveNotificationSound } from "../lib/notificationSound";

interface LiveAlertMessage {
  eventId: string;
  title: string;
  message: string;
}

const localSseAlertsEnabled = process.env.EXPO_PUBLIC_LOCAL_SSE_ALERTS !== "false";

function AppShell() {
  const { alertsEnabled, resolvedTheme, colors } = useAppPreferences();
  const lastSeenEventIdRef = useRef<string | null>(null);

  useEffect(() => {
    const receivedSub = Notifications.addNotificationReceivedListener(() => {
      // Foreground notification side effects can be added here.
    });

    let es: EventSource | null = null;
    const onAlert = (event: { data?: string }) => {
      if (!event.data || !alertsEnabled) {
        return;
      }

      try {
        const parsed = JSON.parse(event.data) as LiveAlertMessage;
        if (!parsed.eventId || parsed.eventId === lastSeenEventIdRef.current) {
          return;
        }

        lastSeenEventIdRef.current = parsed.eventId;
        const preferredSound = resolveNotificationSound();
        const schedule = async () => {
          try {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: parsed.title || "GWCT Alert",
                body: parsed.message || "",
                sound: preferredSound,
                data: {
                  eventId: parsed.eventId,
                },
              },
              trigger: null,
            });
          } catch {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: parsed.title || "GWCT Alert",
                body: parsed.message || "",
                sound: "default",
                data: {
                  eventId: parsed.eventId,
                },
              },
              trigger: null,
            });
          }
        };

        void schedule();
      } catch {
        // Ignore malformed payloads during hot-reload or server restart.
      }
    };

    if (localSseAlertsEnabled) {
      es = new EventSource(API_URLS.sse);
      es.addEventListener("alert" as any, onAlert as any);
    }

    return () => {
      receivedSub.remove();
      if (es) {
        es.removeEventListener("alert" as any, onAlert as any);
        es.close();
      }
    };
  }, [alertsEnabled]);

  return (
    <>
      <StatusBar style={resolvedTheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.headerBackground },
          headerShadowVisible: false,
          headerTintColor: colors.primaryText,
          headerTitleAlign: "center",
          headerTitleStyle: { fontWeight: "bold", fontSize: 18 },
          contentStyle: { backgroundColor: colors.headerBackground },
          headerLeft: ({ canGoBack }) => {
            if (canGoBack) {
              return (
                <Pressable
                  onPress={() => router.back()}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: colors.surfaceBackground,
                    alignItems: "center",
                    justifyContent: "center",
                    marginLeft: Platform.OS === "ios" ? 0 : 8,
                    shadowColor: colors.shadow,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.05,
                    shadowRadius: 3,
                    elevation: 1,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Ionicons name="chevron-back" size={20} color={colors.primaryText} style={{ marginLeft: -2 }} />
                </Pressable>
              );
            }
            return null;
          },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="vessels"
          options={{ headerTitle: () => <HeaderScrollTitle routeKey="vessels" title="Vessel Schedule" color={colors.primaryText} /> }}
        />
        <Stack.Screen
          name="cranes"
          options={{ headerTitle: () => <HeaderScrollTitle routeKey="cranes" title="Crane Status" color={colors.primaryText} /> }}
        />
        <Stack.Screen
          name="equipment"
          options={{ headerTitle: () => <HeaderScrollTitle routeKey="equipment" title="GC Cabin/Under Status" color={colors.primaryText} /> }}
        />
        <Stack.Screen
          name="yt"
          options={{ headerTitle: () => <HeaderScrollTitle routeKey="yt" title="YT Count" color={colors.primaryText} /> }}
        />
        <Stack.Screen
          name="weather"
          options={{ headerTitle: () => <HeaderScrollTitle routeKey="weather" title="Pilotage/Weather" color={colors.primaryText} /> }}
        />
        <Stack.Screen
          name="monitor"
          options={{ headerTitle: () => <HeaderScrollTitle routeKey="monitor" title="Monitoring" color={colors.primaryText} /> }}
        />
        <Stack.Screen
          name="monitor-gwct-eta"
          options={{ headerTitle: () => <HeaderScrollTitle routeKey="monitor-gwct-eta" title="GWCT ETA Monitor" color={colors.primaryText} /> }}
        />
        <Stack.Screen
          name="monitor-gc-remaining"
          options={{ headerTitle: () => <HeaderScrollTitle routeKey="monitor-gc-remaining" title="GC Remaining" color={colors.primaryText} /> }}
        />
        <Stack.Screen
          name="monitor-equipment"
          options={{ headerTitle: () => <HeaderScrollTitle routeKey="monitor-equipment" title="Equipment Monitor" color={colors.primaryText} /> }}
        />
        <Stack.Screen
          name="monitor-yeosu"
          options={{ headerTitle: () => <HeaderScrollTitle routeKey="monitor-yeosu" title="Yeosu Pilotage" color={colors.primaryText} /> }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AppPreferencesProvider>
      <AppShell />
    </AppPreferencesProvider>
  );
}
