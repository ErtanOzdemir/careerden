import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { embeddedAiModelCatalog, parseAiModelCatalog } from "@careerden/contracts";
import { AiModelCatalogManager } from "./ai-model-catalog-manager.js";

const remoteCatalog = {
  schemaVersion: 1,
  providers: { openai: { recommended: "gpt-5-mini", fallbacks: ["gpt-4.1-mini"] } },
};

function createManager(overrides: Partial<ConstructorParameters<typeof AiModelCatalogManager>[0]>) {
  return new AiModelCatalogManager({
    readCachedCatalog: vi.fn(async () => undefined),
    writeCachedCatalog: vi.fn(async () => undefined),
    setInterval: vi.fn(),
    logger: { warn: vi.fn() },
    ...overrides,
  });
}

describe("AiModelCatalogManager", () => {
  it("runs on the embedded defaults when the remote catalog cannot be fetched", async () => {
    const manager = createManager({
      fetchCatalog: vi.fn(async () => {
        throw new Error("fetch failed");
      }),
    });

    await manager.start();
    await manager.refresh();

    expect(manager.current()).toEqual(embeddedAiModelCatalog);
    expect(manager.withModels({ provider: "anthropic", apiKey: "key" })).toEqual({
      provider: "anthropic",
      apiKey: "key",
      models: embeddedAiModelCatalog.providers.anthropic,
    });
  });

  it("runs on the embedded defaults when no update repository is configured", async () => {
    const setInterval = vi.fn();
    const manager = createManager({ setInterval });

    await manager.start();

    expect(manager.current()).toEqual(embeddedAiModelCatalog);
    expect(setInterval).not.toHaveBeenCalled();
  });

  it("applies and caches a valid remote catalog, keeping defaults for omitted providers", async () => {
    const writeCachedCatalog = vi.fn(async () => undefined);
    const manager = createManager({
      fetchCatalog: vi.fn(async () => remoteCatalog),
      writeCachedCatalog,
    });

    await manager.refresh();

    expect(manager.current().providers.openai).toEqual(remoteCatalog.providers.openai);
    expect(manager.current().providers.gemini).toEqual(embeddedAiModelCatalog.providers.gemini);
    expect(writeCachedCatalog).toHaveBeenCalledWith(remoteCatalog);
  });

  it("keeps the cached catalog when the remote one is invalid", async () => {
    const writeCachedCatalog = vi.fn(async () => undefined);
    const manager = createManager({
      readCachedCatalog: vi.fn(async () => remoteCatalog),
      fetchCatalog: vi.fn(async () => ({ schemaVersion: 1, providers: { openai: {} } })),
      writeCachedCatalog,
    });

    await manager.start();
    await manager.refresh();

    expect(manager.current().providers.openai.recommended).toBe("gpt-5-mini");
    expect(writeCachedCatalog).not.toHaveBeenCalled();
  });

  it("ignores an invalid cache and refreshes hourly", async () => {
    const setInterval = vi.fn();
    const manager = createManager({
      readCachedCatalog: vi.fn(async () => ({ schemaVersion: 9 })),
      fetchCatalog: vi.fn(async () => {
        throw new Error("offline");
      }),
      setInterval,
    });

    await manager.start();

    expect(manager.current()).toEqual(embeddedAiModelCatalog);
    expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 60 * 60 * 1000);
  });
});

describe("ai-models.json", () => {
  it("is a valid catalog that matches the embedded defaults", async () => {
    const published = JSON.parse(
      await readFile(new URL("../../../ai-models.json", import.meta.url), "utf8"),
    ) as unknown;

    // Edit both together, so the next release embeds what installed apps already fetch.
    expect(parseAiModelCatalog(published)).toEqual(embeddedAiModelCatalog);
  });
});
