import type { HttpClient } from "../../domain/ports/http-client";
import type { Logger } from "../../domain/ports/system";

/** What every university adapter gets handed. Keeps adapters free of globals. */
export interface AdapterDeps {
  http: HttpClient;
  logger: Logger;
}
