import { Stack, router } from "expo-router";
import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { Platform, Pressable } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import EventSource from "react-native-sse";
import { API_URLS } from "../lib/config";
import { getExpoPushTokenSafe, localDeviceId } from "../lib/push";
import { resolveNotificationSound } from "../lib/notificationSound";

interface LiveAlertMessage {
  eventId: string;
  title: string;
  message: string;
}

const localSseAlertsEnabled = process.env.EXPO_PUBLIC_LOCAL_SSE_ALERTS !== "false";

export default function RootLayout() {
  const lastSeenEventIdRef = useRef<string | null>(null);

  useEffect(() => {
    const registerDevice = async () => {
      const expoPushToken = await getExpoPushTokenSafe();
      const payload = {
        deviceId: localDeviceId(),
        platform: Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : "web",
        expoPushToken,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Seoul",
        appVersion: null,
        alertsEnabled: true,
      };

      try {
        await fetch(API_URLS.registerDevice, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch {
        // Keep app working even when server is temporarily unreachable.
      }
    };

    void registerDevice();

    const receivedSub = Notifications.addNotificationReceivedListener(() => {
      // Foreground notification side effects can be added here.
    });

    let es: EventSource | null = null;
    const onAlert = (event: { data?: string }) => {
      if (!event.data) {
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
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#f2f4f6" },
          headerShadowVisible: false,
          headerTintColor: "#000000",
          headerTitleAlign: "center",
          headerTitleStyle: { fontWeight: "bold", fontSize: 18 },
          contentStyle: { backgroundColor: "#f2f4f6" },
          headerLeft: ({ canGoBack }) => {
            if (canGoBack) {
              return (
                <Pressable
                  onPress={() => router.back()}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: "#ffffff",
                    alignItems: "center",
                    justifyContent: "center",
                    marginLeft: Platform.OS === "ios" ? 0 : 8,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.05,
                    shadowRadius: 3,
                    elevation: 1,
                  }}
                >
                  <Ionicons name="chevron-back" size={20} color="#000" style={{ marginLeft: -2 }} />
                </Pressable>
              );
            }
            return null;
          },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="vessels" options={{ title: "Vessel Schedule" }} />
        <Stack.Screen name="cranes" options={{ title: "Crane Status" }} />
        <Stack.Screen name="equipment" options={{ title: "GC Cabin/Under 현황" }} />
        <Stack.Screen name="yt" options={{ title: "YT Count" }} />
        <Stack.Screen name="weather" options={{ title: "Pilotage/Weather" }} />
        <Stack.Screen name="monitor" options={{ title: "Monitoring" }} />
        <Stack.Screen name="monitor-gwct-eta" options={{ title: "GWCT ETA Monitor" }} />
        <Stack.Screen name="monitor-gc-remaining" options={{ title: "GC Remaining" }} />
        <Stack.Screen name="monitor-equipment" options={{ title: "Equipment Monitor" }} />
        <Stack.Screen name="monitor-yeosu" options={{ title: "Yeosu Pilotage" }} />
      </Stack>
    </>
  );
}
