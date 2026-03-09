import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import EventSource from "react-native-sse";
import { API_URLS } from "../lib/config";

interface UseEndpointOptions {
  pollMs?: number;
  immediate?: boolean;
  liveSources?: string[];
}

interface RefreshOptions {
  silent?: boolean;
}

export function useEndpoint<T>(url: string, options: UseEndpointOptions = {}) {
  const { pollMs, immediate = true, liveSources } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const liveSourceKey = useMemo(
    () => (liveSources && liveSources.length ? [...liveSources].sort().join("|") : ""),
    [liveSources],
  );

  const refresh = useCallback(
    async (refreshOptions: RefreshOptions = {}) => {
      if (inFlightRef.current) {
        return;
      }

      inFlightRef.current = true;
      if (!refreshOptions.silent) {
        setLoading(true);
      }
      setError(null);

      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const json = (await response.json()) as T;
        setData(json);
        setUpdatedAt(new Date().toISOString());
      } catch (err) {
        setError((err as Error).message);
      } finally {
        inFlightRef.current = false;
        if (!refreshOptions.silent) {
          setLoading(false);
        }
      }
    },
    [url],
  );

  useEffect(() => {
    if (!immediate) {
      setLoading(false);
      return;
    }
    void refresh();
  }, [immediate, refresh]);

  useEffect(() => {
    if (!pollMs || pollMs <= 0) {
      return;
    }

    const timer = setInterval(() => {
      void refresh({ silent: true });
    }, pollMs);

    return () => {
      clearInterval(timer);
    };
  }, [pollMs, refresh]);

  useEffect(() => {
    if (!liveSources?.length) {
      return;
    }

    const trackedSources = new Set(liveSources);
    const es = new EventSource(API_URLS.sse);

    const onSourceUpdated = (event: { data?: string }) => {
      if (!event.data) {
        return;
      }

      try {
        const parsed = JSON.parse(event.data) as { source?: string };
        if (!parsed.source || !trackedSources.has(parsed.source)) {
          return;
        }
        void refresh({ silent: true });
      } catch {
        // Ignore malformed SSE payloads during reconnects.
      }
    };

    es.addEventListener("source_updated" as any, onSourceUpdated as any);

    return () => {
      es.removeEventListener("source_updated" as any, onSourceUpdated as any);
      es.close();
    };
  }, [liveSourceKey, liveSources, refresh]);

  return {
    data,
    loading,
    error,
    updatedAt,
    refresh,
    setData,
  };
}
