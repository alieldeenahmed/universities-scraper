import { createContext, useContext, type ReactNode } from "react";
import type { CatalogGateway } from "../application/ports";

const GatewayContext = createContext<CatalogGateway | null>(null);

export function GatewayProvider({ gateway, children }: { gateway: CatalogGateway; children: ReactNode }) {
  return <GatewayContext.Provider value={gateway}>{children}</GatewayContext.Provider>;
}

export function useGateway(): CatalogGateway {
  const gateway = useContext(GatewayContext);
  if (!gateway) throw new Error("useGateway needs a GatewayProvider above it");
  return gateway;
}
