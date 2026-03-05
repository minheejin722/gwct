import { useCallback, useEffect, useState } from "react";

interface UseEndpointOptions {
  pollMs?: number;
  immediate?: boolean;
}

interface RefreshOptions {
  silent?: boolean;
}

export function useEndpoint<T>(url: string, options: UseEndpointOptions = {}) {
  const { pollMs, immediate = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const refresh = useCallback(
    async (refreshOptions: RefreshOptions = {}) => {
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

  return {
    data,
    loading,
    error,
    updatedAt,
    refresh,
    setData,
  };
}
