import { resolveAlertSoundPath } from "@gwct/shared";
import Constants from "expo-constants";
import { Platform } from "react-native";

function isExpoGo(): boolean {
  return Constants.executionEnvironment === "storeClient";
}

export function resolveNotificationSound(): string {
  const platform = Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : "web";
  const preferCustom = process.env.EXPO_PUBLIC_IOS_CUSTOM_ALERT_SOUND === "true";
  return resolveAlertSoundPath({
    platform,
    preferCustomIosSound: preferCustom,
    customSoundAvailable: !isExpoGo(),
  });
}
