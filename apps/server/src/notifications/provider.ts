import type { EventCategory } from "@gwct/shared";

export interface NotificationRecipient {
  token: string;
  platform: "ios" | "android" | "web";
}

export interface NotificationRequest {
  eventId: string;
  category: EventCategory;
  title: string;
  body: string;
  data: Record<string, unknown>;
  recipients: NotificationRecipient[];
}

export interface NotificationResult {
  provider: string;
  success: boolean;
  successCount: number;
  errorCount: number;
  errors: string[];
}

export interface NotificationProvider {
  readonly name: string;
  send(request: NotificationRequest): Promise<NotificationResult>;
}
