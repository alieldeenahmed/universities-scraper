import { createContext, useContext, type ReactNode } from "react";
import { pollIntervalMs } from "../application/crawl-controls";
import type { University } from "../domain/university";
import { useGateway } from "./gateway-context";
import { usePolling } from "./hooks/use-polling";

interface UniversitiesState {
  universities: University[] | undefined;
  error: Error | null;
  loading: boolean;
  reload: () => void;
}

const UniversitiesContext = createContext<UniversitiesState | null>(null);

/**
 * One list of universities for the whole app. The sidebar, the majors page and
 * the crawls page all read it, and it is refreshed quickly while a crawl runs.
 */
export function UniversitiesProvider({ children }: { children: ReactNode }) {
  const gateway = useGateway();
  const state = usePolling(
    () => gateway.listUniversities(),
    (data) => pollIntervalMs(data ?? []),
  );

  return (
    <UniversitiesContext.Provider
      value={{ universities: state.data, error: state.error, loading: state.loading, reload: state.reload }}
    >
      {children}
    </UniversitiesContext.Provider>
  );
}

export function useUniversities(): UniversitiesState {
  const state = useContext(UniversitiesContext);
  if (!state) throw new Error("useUniversities needs a UniversitiesProvider above it");
  return state;
}
