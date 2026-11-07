import {
  parseAiModelCatalog,
  resolveAiModelCatalog,
  type AiModelCatalog,
  type ResolvedAiModelCatalog,
} from "@careerden/contracts";
import type { AiProviderSelection } from "@careerden/infrastructure";

const defaultRefreshIntervalMs = 60 * 60 * 1000;

export interface AiModelCatalogManagerDependencies {
  /** Fetches the published `ai-models.json`. Absent when no update repository is configured. */
  fetchCatalog?: () => Promise<unknown>;
  readCachedCatalog: () => Promise<unknown | undefined>;
  writeCachedCatalog: (catalog: AiModelCatalog) => Promise<void>;
  refreshIntervalMs?: number;
  setInterval?: (callback: () => void, ms: number) => unknown;
  logger?: Pick<Console, "warn">;
}

/**
 * Keeps the AI model catalog current without a release. Uses the last valid remote catalog,
 * then the last valid cached one, then the defaults embedded in this build.
 */
export class AiModelCatalogManager {
  private catalog: ResolvedAiModelCatalog = resolveAiModelCatalog();
  private refreshPromise: Promise<void> | undefined;

  constructor(private readonly dependencies: AiModelCatalogManagerDependencies) {}

  async start(): Promise<void> {
    await this.loadCachedCatalog();
    if (!this.dependencies.fetchCatalog) return;

    void this.refresh();
    (this.dependencies.setInterval ?? setInterval)(() => {
      void this.refresh();
    }, this.dependencies.refreshIntervalMs ?? defaultRefreshIntervalMs);
  }

  current(): ResolvedAiModelCatalog {
    return this.catalog;
  }

  /** Adds the catalog's recommended and fallback models for the selected provider. */
  withModels(selection: AiProviderSelection): AiProviderSelection {
    return { ...selection, models: this.catalog.providers[selection.provider] };
  }

  refresh(): Promise<void> {
    const fetchCatalog = this.dependencies.fetchCatalog;
    if (!fetchCatalog) return Promise.resolve();
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async () => {
      try {
        const catalog = parseAiModelCatalog(await fetchCatalog());
        this.catalog = resolveAiModelCatalog(catalog);
        await this.dependencies.writeCachedCatalog(catalog);
      } catch (error) {
        this.logger.warn("Could not refresh the AI model catalog; keeping the current one", error);
      }
    })().finally(() => {
      this.refreshPromise = undefined;
    });

    return this.refreshPromise;
  }

  private async loadCachedCatalog(): Promise<void> {
    try {
      const cached = await this.dependencies.readCachedCatalog();
      if (cached !== undefined) this.catalog = resolveAiModelCatalog(parseAiModelCatalog(cached));
    } catch (error) {
      this.logger.warn("Ignoring an invalid cached AI model catalog", error);
    }
  }

  private get logger(): Pick<Console, "warn"> {
    return this.dependencies.logger ?? console;
  }
}
