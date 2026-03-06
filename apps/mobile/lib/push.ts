import * as Notifications from "expo-notifications";
import * as Device from "expo-device";

const EVENT_DEDUPE_WINDOW_MS = 5 * 60 * 1000;
const seenAlertEvents = new Map<string, number>();
const presentationPrefs = {
  alertsEnabled: true,
  bannerEnabled: true,
};

function pruneSeenAlertEvents(now: number): void {
  for (const [eventId, seenAt] of seenAlertEvents.entries()) {
    if (now - seenAt > EVENT_DEDUPE_WINDOW_MS) {
      seenAlertEvents.delete(eventId);
    }
  }
}

function extractEventId(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const maybeEventId = (value as Record<string, unknown>).eventId;
  if (typeof maybeEventId !== "string") {
    return null;
  }
  const trimmed = maybeEventId.trim();
  return trimmed.length ? trimmed : null;
}

export function rememberAlertEvent(eventId: string): boolean {
  const now = Date.now();
  pruneSeenAlertEvents(now);

  const normalized = eventId.trim();
  if (!normalized.length) {
    return true;
  }

  if (seenAlertEvents.has(normalized)) {
    return false;
  }

  seenAlertEvents.set(normalized, now);
  return true;
}

export function configureNotificationPresentation(input: {
  alertsEnabled: boolean;
  bannerEnabled: boolean;
}): void {
  presentationPrefs.alertsEnabled = input.alertsEnabled;
  presentationPrefs.bannerEnabled = input.bannerEnabled;
}

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const eventId = extractEventId(notification.request.content.data);
    if (eventId && !rememberAlertEvent(eventId)) {
      return {
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      };
    }

    if (!presentationPrefs.alertsEnabled) {
      return {
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      };
    }

    return {
      shouldShowAlert: presentationPrefs.bannerEnabled,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: presentationPrefs.bannerEnabled,
      shouldShowList: true,
    };
  },
});

function isPermissionGranted(permission: Notifications.NotificationPermissionsStatus): boolean {
  const iosStatus = permission.ios?.status;
  if (iosStatus !== undefined) {
    return (
      iosStatus === Notifications.IosAuthorizationStatus.AUTHORIZED ||
      iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL ||
      iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL
    );
  }

  const androidImportance = permission.android?.importance;
  if (typeof androidImportance === "number") {
    return androidImportance > 0;
  }

  return false;
}

export async function getExpoPushTokenSafe(): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }

  const permission = await Notifications.getPermissionsAsync();
  if (!isPermissionGranted(permission)) {
    const requested = await Notifications.requestPermissionsAsync();
    if (!isPermissionGranted(requested)) {
      return null;
    }
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync();
    return token.data;
  } catch {
    return null;
  }
}

export function localDeviceId(): string {
  const model = Device.modelName || "ios";
  const osVersion = Device.osVersion || "unknown";
  return `${model}-${osVersion}`.replace(/\s+/g, "-").toLowerCase();
}
