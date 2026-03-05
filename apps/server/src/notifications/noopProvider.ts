import type { NotificationProvider, NotificationRequest, NotificationResult } from "./provider.js";

export class NoopNotificationProvider implements NotificationProvider {
  readonly name = "noop";

  async send(request: NotificationRequest): Promise<NotificationResult> {
    return {
      provider: this.name,
      success: true,
      successCount: request.recipients.length,
      errorCount: 0,
      errors: [],
    };
  }
}
