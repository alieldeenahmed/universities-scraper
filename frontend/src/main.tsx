import "@fontsource-variable/inter";
import "@fontsource-variable/source-serif-4";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { HttpCatalogGateway } from "./infrastructure/api/http-catalog-gateway";
import { App } from "./presentation/app";
import { GatewayProvider } from "./presentation/gateway-context";
import "./presentation/styles/tokens.css";
import "./presentation/styles/base.css";
import "./presentation/styles/layout.css";
import "./presentation/styles/components.css";

// empty means same origin: in development vite proxies /api, in production the backend serves this app
const gateway = new HttpCatalogGateway(import.meta.env.VITE_API_BASE_URL ?? "");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GatewayProvider gateway={gateway}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </GatewayProvider>
  </StrictMode>,
);
