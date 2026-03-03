import * as Notifications from "expo-notifications";
import * as Device from "expo-device";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
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
