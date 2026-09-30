import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncState<T> {
  data: T | undefined;
  error: Error | null;
  loading: boolean;
  reload: () => void;
}

/**
 * Runs `load` when `deps` change. Only the latest request may update the state,
 * so typing quickly in a search box can't show the answer of an older search.
 */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    const request = ++latest.current;
    setLoading(true);
    load().then(
      (result) => {
        if (request !== latest.current) return;
        setData(result);
        setError(null);
        setLoading(false);
      },
      (err: unknown) => {
        if (request !== latest.current) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      },
    );
    // `load` closes over `deps`, so those are what decide when to run again
  }, [...deps, version]);

  // ignore whatever is still in flight after unmount
  useEffect(() => () => void (latest.current = -1), []);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data, error, loading, reload };
}
