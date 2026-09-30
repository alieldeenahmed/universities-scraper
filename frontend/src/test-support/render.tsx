import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { App } from "../presentation/app";
import { GatewayProvider } from "../presentation/gateway-context";
import type { FakeGateway } from "./fake-gateway";

/** Renders the whole app at a route, with the gateway faked. */
export function renderApp(gateway: FakeGateway, route = "/") {
  return render(
    <GatewayProvider gateway={gateway}>
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>
    </GatewayProvider>,
  );
}
