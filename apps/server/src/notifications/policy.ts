export function shouldDispatchRealtimeNotification(eventType: string): boolean {
  return eventType !== "TEXT_CHANGED";
}
