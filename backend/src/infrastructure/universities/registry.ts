import type { UniversityAdapter, UniversityRegistry } from "../../domain/ports/university-adapter";
import type { UniversityInfo } from "../../domain/university";
import type { AdapterDeps } from "./adapter-deps";
import { AUC_INFO, createAucAdapter } from "./auc/auc-adapter";

interface RegistryEntry {
  info: UniversityInfo;
  create: (deps: AdapterDeps) => UniversityAdapter;
}

/**
 * Every university the tool knows about. Adding one = write its adapter folder
 * and add a line here, nothing else in the app needs to know.
 */
const ENTRIES: RegistryEntry[] = [{ info: AUC_INFO, create: createAucAdapter }];

export class StaticUniversityRegistry implements UniversityRegistry {
  constructor(
    private readonly deps: AdapterDeps,
    private readonly entries: RegistryEntry[] = ENTRIES,
  ) {}

  list(): UniversityInfo[] {
    return this.entries.map((e) => e.info);
  }

  createAdapter(slug: string): UniversityAdapter {
    const entry = this.entries.find((e) => e.info.slug === slug);
    if (!entry) throw new Error(`no adapter registered for "${slug}"`);
    return entry.create(this.deps);
  }
}
