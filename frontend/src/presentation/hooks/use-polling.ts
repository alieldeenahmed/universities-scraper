import { useCallback, useEffect, useRef, useState } from "react";
import type { AsyncState } from "./use-async";

/**
 * Loads once, then again after `nextDelayMs(data)`. The delay is asked for after
 * every load so the caller can poll faster while something is in progress.
 * The last good data stays on screen if a refresh fails.
 */
export function usePolling<T>(load: () => Promise<T>, nextDelayMs: (data: T | undefined) => number): AsyncState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  const loadRef = useRef(load);
  const delayRef = useRef(nextDelayMs);
  loadRef.current = load;
  delayRef.current = nextDelayMs;

  const lastGood = useRef<T | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  const run = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    try {
      const latest = await loadRef.current();
      if (!alive.current) return;
      lastGood.current = latest;
      setData(latest);
      setError(null);
    } catch (err) {
      if (!alive.current) return;
      setError(err instanceof Error ? err : new Error(String(err)));
    }
    setLoading(false);
    timer.current = setTimeout(() => void run(), delayRef.current(lastGood.current));
  }, []);

  useEffect(() => {
    alive.current = true;
    void run();
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [run]);

  return { data, error, loading, reload: () => void run() };
}
