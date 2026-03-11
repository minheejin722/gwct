import { EVENT_TO_DEEPLINK, type DeepLinkTarget, type EventCategory } from "@gwct/shared";
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
    const recipients = this.mapRecipients(devices);

    const deepLink = EVENT_TO_DEEPLINK[event.type] || "alerts";
    const payload = {
      eventId,
      category: event.category,
      eventType: event.type,
      deepLink,
      entityKey: (event.payload.entityKey as string | undefined) || null,
      raw: event.payload,
    };

    const result = await this.sendPayload({
      eventId,
      category: event.category,
      title: event.title,
      body: event.message,
      payload,
      recipients,
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

  async dispatchToDeviceIds(input: {
    eventId: string;
    category: EventCategory;
    eventType: string;
    deepLink: DeepLinkTarget;
    title: string;
    body: string;
    deviceIds: string[];
    forcePresentation?: boolean;
    autoOpen?: boolean;
    entityKey?: string | null;
    raw?: Record<string, unknown>;
  }): Promise<void> {
    const devices = await this.repo.listDevicesByIds(input.deviceIds);
    const recipients = this.mapRecipients(devices);
    const payload = {
      eventId: input.eventId,
      category: input.category,
      eventType: input.eventType,
      deepLink: input.deepLink,
      forcePresentation: input.forcePresentation === true,
      autoOpen: input.autoOpen === true,
      entityKey: input.entityKey || null,
      raw: input.raw || {},
    };

    await this.sendPayload({
      eventId: input.eventId,
      category: input.category,
      title: input.title,
      body: input.body,
      payload,
      recipients,
    });
  }

  private mapRecipients(
    devices: Array<{ expoPushToken: string | null; platform: string; bannerEnabled: boolean }>,
  ): NotificationRecipient[] {
    return devices
      .filter((device) => Boolean(device.expoPushToken))
      .map((device) => ({
        token: device.expoPushToken!,
        platform: normalizePlatform(device.platform),
        bannerEnabled: device.bannerEnabled !== false,
      }));
  }

  private async sendPayload(input: {
    eventId: string;
    category: EventCategory;
    title: string;
    body: string;
    payload: Record<string, unknown>;
    recipients: NotificationRecipient[];
  }) {
    const result = await this.provider.send({
      eventId: input.eventId,
      category: input.category,
      title: input.title,
      body: input.body,
      data: input.payload,
      recipients: input.recipients,
    });

    await this.repo.logNotification({
      eventId: input.eventId,
      category: input.category,
      title: input.title,
      body: input.body,
      provider: result.provider,
      success: result.success,
      error: result.errors.join("; ") || null,
      payload: input.payload,
      recipientCount: input.recipients.length,
    });

    return result;
  }
}
