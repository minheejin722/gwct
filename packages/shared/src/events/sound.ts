export const IOS_TRI_TONE_SOUND_PATH = "sounds/ios-tritone.caf";
export const DEFAULT_NOTIFICATION_SOUND = "default";

export type NotificationPlatform = "ios" | "android" | "web";

export interface ResolveNotificationSoundInput {
  platform: NotificationPlatform;
  preferCustomIosSound: boolean;
  customSoundAvailable: boolean;
}

export function resolveAlertSoundPath(input: ResolveNotificationSoundInput): string {
  if (
    input.platform === "ios" &&
    input.preferCustomIosSound &&
    input.customSoundAvailable
  ) {
    return IOS_TRI_TONE_SOUND_PATH;
  }
  return DEFAULT_NOTIFICATION_SOUND;
}
