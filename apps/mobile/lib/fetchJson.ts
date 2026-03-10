export async function fetchJson<T>(input: string, init: RequestInit = {}, timeoutMs = 10000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });

    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try {
        const errorPayload = (await response.json()) as { error?: string };
        if (typeof errorPayload.error === "string" && errorPayload.error.trim().length) {
          message = errorPayload.error.trim();
        }
      } catch {
        // Ignore non-JSON error bodies and keep the HTTP status message.
      }
      throw new Error(message);
    }

    return (await response.json()) as T;
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new Error("Request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
