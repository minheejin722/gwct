import { env } from "../config/env.js";
import type { NotificationProvider, NotificationRequest, NotificationResult } from "./provider.js";

export class ExpoPushProvider implements NotificationProvider {
  readonly name = "expo";

  async send(request: NotificationRequest): Promise<NotificationResult> {
    if (!request.tokens.length) {
      return {
        provider: this.name,
        success: true,
        successCount: 0,
        errorCount: 0,
        errors: [],
      };
    }

    const messages = request.tokens.map((token) => ({
      to: token,
      title: request.title,
      body: request.body,
      data: request.data,
      sound: "default",
      priority: "high",
    }));

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(env.EXPO_ACCESS_TOKEN
          ? {
              Authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}`,
            }
          : {}),
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      return {
        provider: this.name,
        success: false,
        successCount: 0,
        errorCount: request.tokens.length,
        errors: [`Expo HTTP ${response.status}`],
      };
    }

    const payload = (await response.json()) as {
      data?: Array<{ status: string; message?: string }>;
      errors?: Array<{ message?: string }>;
    };

    const tickets = payload.data || [];
    const errors = [
      ...(payload.errors?.map((error) => error.message || "unknown expo error") || []),
      ...tickets
        .filter((ticket) => ticket.status !== "ok")
        .map((ticket) => ticket.message || "push failed"),
    ];

    return {
      provider: this.name,
      success: errors.length === 0,
      successCount: request.tokens.length - errors.length,
      errorCount: errors.length,
      errors,
    };
  }
}
