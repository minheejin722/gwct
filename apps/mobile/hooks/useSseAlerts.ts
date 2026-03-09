import { useEffect, useState } from "react";
import EventSource from "react-native-sse";
import { API_URLS } from "../lib/config";

export interface LiveAlertMessage {
  eventId: string;
  category: string;
  type: string;
  title: string;
  message: string;
  occurredAt: string;
}

export function useSseAlerts() {
  const [lastAlert, setLastAlert] = useState<LiveAlertMessage | null>(null);
  const [connected, setConnected] = useState(false);
  const [eventsClearedAt, setEventsClearedAt] = useState<string | null>(null);

  useEffect(() => {
    const es = new EventSource(API_URLS.sse);

    const onOpen = () => setConnected(true);
    const onError = () => setConnected(false);
    const onAlert = (event: { data?: string }) => {
      if (!event.data) {
        return;
      }
      try {
        const parsed = JSON.parse(event.data) as LiveAlertMessage;
        setLastAlert(parsed);
      } catch {
        // Ignore malformed messages from development server restarts.
      }
    };
    const onEventsCleared = (event: { data?: string }) => {
      let clearedAt = new Date().toISOString();
      if (event.data) {
        try {
          const parsed = JSON.parse(event.data) as { clearedAt?: string };
          if (parsed.clearedAt) {
            clearedAt = parsed.clearedAt;
          }
        } catch {
          // Ignore malformed payloads and still clear the local state.
        }
      }
      setLastAlert(null);
      setEventsClearedAt(clearedAt);
    };

    es.addEventListener("open", onOpen);
    es.addEventListener("error", onError);
    es.addEventListener("alert" as any, onAlert as any);
    es.addEventListener("events_cleared" as any, onEventsCleared as any);

    return () => {
      es.removeEventListener("open", onOpen);
      es.removeEventListener("error", onError);
      es.removeEventListener("alert" as any, onAlert as any);
      es.removeEventListener("events_cleared" as any, onEventsCleared as any);
      es.close();
    };
  }, []);

  return {
    connected,
    eventsClearedAt,
    lastAlert,
  };
}
