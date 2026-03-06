import { afterEach, describe, expect, it, vi } from "vitest";

if (process.env.MODE !== "live" && process.env.MODE !== "fixture") {
  process.env.MODE = "fixture";
}

const { ExpoPushProvider } = await import("../src/notifications/expoProvider.js");

describe("expo push provider", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("sends normal alert payloads to banner-enabled devices", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ status: "ok" }],
      }),
    });
    global.fetch = fetchMock as typeof fetch;

    const provider = new ExpoPushProvider();
    const result = await provider.send({
      eventId: "evt-banner-on",
      category: "YT",
      title: "YT 로그인 수 하락",
      body: "YT 로그인 수가 임계치 아래입니다.",
      data: { eventId: "evt-banner-on" },
      recipients: [
        {
          token: "ExponentPushToken[banner-on]",
          platform: "ios",
          bannerEnabled: true,
        },
      ],
    });

    expect(result.success).toBe(true);
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Array<Record<string, unknown>>;
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      to: "ExponentPushToken[banner-on]",
      title: "YT 로그인 수 하락",
      body: "YT 로그인 수가 임계치 아래입니다.",
      priority: "high",
    });
    expect(body[0]?.sound).toBeTruthy();
  });

  it("sends headless background payloads to banner-disabled devices", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ status: "ok" }, { status: "ok" }],
      }),
    });
    global.fetch = fetchMock as typeof fetch;

    const provider = new ExpoPushProvider();
    const result = await provider.send({
      eventId: "evt-banner-off",
      category: "CRANE",
      title: "GC188 Cabin 교대",
      body: "GC188 Cabin A -> B 교대",
      data: { eventId: "evt-banner-off" },
      recipients: [
        {
          token: "ExponentPushToken[ios-headless]",
          platform: "ios",
          bannerEnabled: false,
        },
        {
          token: "ExponentPushToken[android-headless]",
          platform: "android",
          bannerEnabled: false,
        },
      ],
    });

    expect(result.success).toBe(true);
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Array<Record<string, unknown>>;
    expect(body).toHaveLength(2);

    expect(body[0]).toMatchObject({
      to: "ExponentPushToken[ios-headless]",
      priority: "high",
      _contentAvailable: true,
      data: { eventId: "evt-banner-off" },
    });
    expect(body[0]).not.toHaveProperty("title");
    expect(body[0]).not.toHaveProperty("body");
    expect(body[0]).not.toHaveProperty("sound");

    expect(body[1]).toMatchObject({
      to: "ExponentPushToken[android-headless]",
      priority: "high",
      data: { eventId: "evt-banner-off" },
    });
    expect(body[1]).not.toHaveProperty("_contentAvailable");
    expect(body[1]).not.toHaveProperty("title");
    expect(body[1]).not.toHaveProperty("body");
    expect(body[1]).not.toHaveProperty("sound");
  });
});
