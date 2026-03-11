import { Stack, router, usePathname } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { Platform, Pressable } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import EventSource from "react-native-sse";
import { HeaderScrollTitle } from "../components/HeaderScrollTitle";
import { AppPreferencesProvider, useAppPreferences } from "../lib/appPreferences";
import { API_URLS } from "../lib/config";
import { resolveNotificationSound } from "../lib/notificationSound";
import { localDeviceId } from "../lib/push";

interface LiveAlertMessage {
  eventId: string;
  title: string;
  message: string;
}

interface YtMasterCallChangedMessage {
  eventId?: string;
  type?: string;
  masterDeviceIds?: string[];
  title?: string;
  message?: string;
}

interface YtMasterCallResolvedMessage {
  eventId?: string;
  driverDeviceId?: string;
  title?: string;
  message?: string;
}

const localSseAlertsEnabled = process.env.EXPO_PUBLIC_LOCAL_SSE_ALERTS !== "false";
const REF_CALL_HEADER = {
  background: "#ececf1",
  text: "#0d0d0f",
};
const YT_MASTER_CALL_ROUTE = "/yt-master-call";
const YT_MASTER_CALL_DEEP_LINK = "yt-master-call";
const NOTIFICATION_ROUTE_BY_DEEP_LINK = {
  home: "/",
  vessels: "/vessels",
  cranes: "/cranes",
  equipment: "/equipment",
  yt: "/yt",
  weather: "/weather",
  alerts: "/alerts",
  settings: "/settings",
  "yt-master-call": YT_MASTER_CALL_ROUTE,
} as const;

function resolveNotificationRoute(data: unknown): string | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const deepLink = (data as Record<string, unknown>).deepLink;
  if (typeof deepLink !== "string") {
    return null;
  }

  return NOTIFICATION_ROUTE_BY_DEEP_LINK[deepLink as keyof typeof NOTIFICATION_ROUTE_BY_DEEP_LINK] || null;
}

function extractNotificationEventId(data: unknown, fallbackId?: string): string {
  if (data && typeof data === "object") {
    const eventId = (data as Record<string, unknown>).eventId;
    if (typeof eventId === "string" && eventId.trim().length) {
      return eventId.trim();
    }
  }
  return fallbackId?.trim() || "notification";
}

function shouldAutoOpenNotificationRoute(data: unknown, route: string | null): boolean {
  if (!route) {
    return false;
  }
  if (route === YT_MASTER_CALL_ROUTE) {
    return true;
  }
  if (!data || typeof data !== "object") {
    return false;
  }
  return (data as Record<string, unknown>).autoOpen === true;
}

function AppShell() {
  const { alertsEnabled, resolvedTheme, colors } = useAppPreferences();
  const pathname = usePathname();
  const deviceIdRef = useRef<string | null>(null);
  const lastSeenEventIdRef = useRef<string | null>(null);
  const lastHandledNotificationEventRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    void localDeviceId().then((deviceId) => {
      if (active) {
        deviceIdRef.current = deviceId;
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const openNotificationRoute = useCallback(
    async (data: unknown, fallbackId?: string, options?: { clearLastResponse?: boolean; autoOnly?: boolean }) => {
      const route = resolveNotificationRoute(data);
      if (!route) {
        return;
      }
      if (options?.autoOnly && !shouldAutoOpenNotificationRoute(data, route)) {
        return;
      }

      const eventId = extractNotificationEventId(data, fallbackId);
      if (lastHandledNotificationEventRef.current === eventId) {
        if (options?.clearLastResponse) {
          await Notifications.clearLastNotificationResponseAsync();
        }
        return;
      }
      lastHandledNotificationEventRef.current = eventId;

      if (pathname !== route) {
        router.push(route as Parameters<typeof router.push>[0]);
      }

      if (options?.clearLastResponse) {
        await Notifications.clearLastNotificationResponseAsync();
      }
    },
    [pathname],
  );

  const handleNotificationResponse = useCallback(
    async (response: Notifications.NotificationResponse | null) => {
      if (!response) {
        return;
      }

      await openNotificationRoute(response.notification.request.content.data, response.notification.request.identifier, {
        clearLastResponse: true,
      });
    },
    [openNotificationRoute],
  );

  useEffect(() => {
    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      void openNotificationRoute(notification.request.content.data, notification.request.identifier, {
        autoOnly: true,
      });
    });
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      void handleNotificationResponse(response);
    });

    let es: EventSource | null = null;
    const scheduleLocalNotification = async (
      eventId: string,
      title: string,
      body: string,
      options?: {
        forcePresentation?: boolean;
        deepLink?: string;
        autoOpen?: boolean;
      },
    ) => {
      const preferredSound = resolveNotificationSound();
      const data = {
        eventId,
        forcePresentation: options?.forcePresentation === true,
        ...(options?.deepLink ? { deepLink: options.deepLink } : {}),
        ...(options?.autoOpen ? { autoOpen: true } : {}),
      };
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            sound: preferredSound,
            data,
          },
          trigger: null,
        });
      } catch {
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            sound: "default",
            data,
          },
          trigger: null,
        });
      }
    };

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
        void scheduleLocalNotification(parsed.eventId, parsed.title || "GWCT Alert", parsed.message || "");
      } catch {
        // Ignore malformed payloads during hot-reload or server restart.
      }
    };

    const onYtMasterCallChanged = (event: { data?: string }) => {
      if (!event.data) {
        return;
      }

      try {
        const parsed = JSON.parse(event.data) as YtMasterCallChangedMessage;
        if (parsed.type !== "created") {
          return;
        }

        const currentDeviceId = deviceIdRef.current;
        const targetDeviceIds = Array.isArray(parsed.masterDeviceIds)
          ? parsed.masterDeviceIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
          : [];
        if (!currentDeviceId || !targetDeviceIds.includes(currentDeviceId)) {
          return;
        }

        const eventId = extractNotificationEventId(parsed, "yt-master-call-created");
        void scheduleLocalNotification(
          eventId,
          parsed.title || "\uBC18\uC7A5 \uD638\uCD9C \uC811\uC218",
          parsed.message || "\uC0C8 \uBC18\uC7A5 \uD638\uCD9C\uC774 \uB3C4\uCC29\uD588\uC2B5\uB2C8\uB2E4.",
          {
            forcePresentation: true,
            deepLink: YT_MASTER_CALL_DEEP_LINK,
            autoOpen: true,
          },
        );
        void openNotificationRoute(
          {
            eventId,
            deepLink: YT_MASTER_CALL_DEEP_LINK,
            autoOpen: true,
          },
          eventId,
          { autoOnly: true },
        );
      } catch {
        // Ignore malformed payloads during hot-reload or server restart.
      }
    };

    const onYtMasterCallResolved = (event: { data?: string }) => {
      if (!event.data) {
        return;
      }

      try {
        const parsed = JSON.parse(event.data) as YtMasterCallResolvedMessage;
        const currentDeviceId = deviceIdRef.current;
        if (!currentDeviceId || parsed.driverDeviceId !== currentDeviceId) {
          return;
        }

        const eventId = extractNotificationEventId(parsed, "yt-master-call-resolved");
        void scheduleLocalNotification(
          eventId,
          parsed.title || "\uBC18\uC7A5 \uD638\uCD9C \uC0C1\uD0DC \uBCC0\uACBD",
          parsed.message || "\uBC18\uC7A5 \uD638\uCD9C \uC0C1\uD0DC\uAC00 \uBCC0\uACBD\uB418\uC5C8\uC2B5\uB2C8\uB2E4.",
          {
            forcePresentation: true,
            deepLink: YT_MASTER_CALL_DEEP_LINK,
            autoOpen: true,
          },
        );
        void openNotificationRoute(
          {
            eventId,
            deepLink: YT_MASTER_CALL_DEEP_LINK,
            autoOpen: true,
          },
          eventId,
          { autoOnly: true },
        );
      } catch {
        // Ignore malformed payloads during hot-reload or server restart.
      }
    };

    if (localSseAlertsEnabled) {
      es = new EventSource(API_URLS.sse);
      es.addEventListener("alert" as any, onAlert as any);
      es.addEventListener("yt_master_call_changed" as any, onYtMasterCallChanged as any);
      es.addEventListener("yt_master_call_resolved" as any, onYtMasterCallResolved as any);
    }

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      void handleNotificationResponse(response);
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
      if (es) {
        es.removeEventListener("alert" as any, onAlert as any);
        es.removeEventListener("yt_master_call_changed" as any, onYtMasterCallChanged as any);
        es.removeEventListener("yt_master_call_resolved" as any, onYtMasterCallResolved as any);
        es.close();
      }
    };
  }, [alertsEnabled, handleNotificationResponse, openNotificationRoute]);

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
          name="yt-master-call"
          options={{
            headerTitle: () => (
              <HeaderScrollTitle
                routeKey="yt-master-call"
                title={"\uBC18\uC7A5 \uD638\uCD9C"}
                color={REF_CALL_HEADER.text}
              />
            ),
            headerStyle: { backgroundColor: REF_CALL_HEADER.background },
            headerTintColor: REF_CALL_HEADER.text,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: REF_CALL_HEADER.background },
          }}
        />
        <Stack.Screen
          name="yt-master-call-settings"
          options={{
            headerTitle: () => <HeaderScrollTitle routeKey="yt-master-call-settings" title="YT Master Call" color={colors.primaryText} />,
          }}
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
