import { describe, expect, it } from "vitest";
import { shouldDispatchRealtimeNotification } from "../src/notifications/policy.js";

describe("notification policy", () => {
  it("suppresses realtime notification for TEXT_CHANGED history events", () => {
    expect(shouldDispatchRealtimeNotification("TEXT_CHANGED")).toBe(false);
    expect(shouldDispatchRealtimeNotification("ALL_SUSPENDED")).toBe(true);
    expect(shouldDispatchRealtimeNotification("RESUMED")).toBe(true);
  });
});
