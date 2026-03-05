import { EVENT_TO_DEEPLINK } from "@gwct/shared";
import type { AlertEventInput, Repository } from "../db/repository.js";
import type { SseHub } from "../lib/sse.js";
import type { NotificationProvider, NotificationRecipient } from "./provider.js";

function normalizePlatform(value: string): NotificationRecipient["platform"] {
  if (value === "ios" || value === "android") {
    return value;
  }
  return "web";
}

export class NotificationService {
  constructor(
    private readonly repo: Repository,
    private readonly provider: NotificationProvider,
    private readonly sseHub: SseHub,
  ) {}

  async dispatch(eventId: string, event: AlertEventInput): Promise<void> {
    const devices = await this.repo.listDevicesForCategory(event.category);
    const recipients: NotificationRecipient[] = devices
      .filter((device) => Boolean(device.expoPushToken))
      .map((device) => ({
        token: device.expoPushToken!,
        platform: normalizePlatform(device.platform),
      }));

    const deepLink = EVENT_TO_DEEPLINK[event.type] || "alerts";
    const payload = {
      eventId,
      category: event.category,
      eventType: event.type,
      deepLink,
      entityKey: (event.payload.entityKey as string | undefined) || null,
      raw: event.payload,
    };

    const result = await this.provider.send({
      eventId,
      category: event.category,
      title: event.title,
      body: event.message,
      data: payload,
      recipients,
    });

    await this.repo.logNotification({
      eventId,
      category: event.category,
      title: event.title,
      body: event.message,
      provider: result.provider,
      success: result.success,
      error: result.errors.join("; ") || null,
      payload,
      recipientCount: recipients.length,
    });

    this.sseHub.broadcast("alert", {
      eventId,
      ...event,
      notification: {
        provider: result.provider,
        success: result.success,
        successCount: result.successCount,
        errorCount: result.errorCount,
      },
    });
  }
}
