import { EVENT_TO_DEEPLINK } from "@gwct/shared";
import type { AlertEventInput, Repository } from "../db/repository.js";
import type { SseHub } from "../lib/sse.js";
import type { NotificationProvider } from "./provider.js";

export class NotificationService {
  constructor(
    private readonly repo: Repository,
    private readonly provider: NotificationProvider,
    private readonly sseHub: SseHub,
  ) {}

  async dispatch(eventId: string, event: AlertEventInput): Promise<void> {
    const devices = await this.repo.listDevicesForCategory(event.category);
    const tokens = devices
      .map((device) => device.expoPushToken)
      .filter((token): token is string => Boolean(token));

    const deepLink = EVENT_TO_DEEPLINK[event.type] || "alerts";
    const payload = {
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
      tokens,
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
      recipientCount: tokens.length,
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
