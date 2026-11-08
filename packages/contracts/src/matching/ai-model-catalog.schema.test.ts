import { describe, expect, it } from "vitest";
import {
  aiModelCatalogSchema,
  embeddedAiModelCatalog,
  parseAiModelCatalog,
  resolveAiModelCatalog,
} from "./ai-model-catalog.schema.js";

describe("aiModelCatalogSchema", () => {
  it("accepts the embedded catalog", () => {
    expect(aiModelCatalogSchema.parse(embeddedAiModelCatalog)).toEqual(embeddedAiModelCatalog);
  });

  it("defaults a missing fallback list to empty", () => {
    expect(
      parseAiModelCatalog({ schemaVersion: 1, providers: { openai: { recommended: "gpt-5" } } }),
    ).toEqual({ schemaVersion: 1, providers: { openai: { recommended: "gpt-5", fallbacks: [] } } });
  });

  it.each([
    ["an unknown schema version", { schemaVersion: 2, providers: {} }],
    ["an unknown provider", { schemaVersion: 1, providers: { mistral: { recommended: "m" } } }],
    ["an empty model id", { schemaVersion: 1, providers: { openai: { recommended: " " } } }],
    [
      "a model id with spaces or markup",
      { schemaVersion: 1, providers: { openai: { recommended: "gpt <script>" } } },
    ],
    [
      "an unknown provider field",
      { schemaVersion: 1, providers: { openai: { recommended: "gpt-5", default: "gpt-5" } } },
    ],
  ])("rejects %s", (_label, value) => {
    expect(() => parseAiModelCatalog(value)).toThrow();
  });
});

describe("resolveAiModelCatalog", () => {
  it("uses the embedded defaults without a catalog", () => {
    expect(resolveAiModelCatalog()).toBe(embeddedAiModelCatalog);
  });

  it("overrides only the providers the catalog lists", () => {
    const resolved = resolveAiModelCatalog(
      parseAiModelCatalog({
        schemaVersion: 1,
        providers: { gemini: { recommended: "gemini-3-flash", fallbacks: ["gemini-2.5-flash"] } },
      }),
    );

    expect(resolved.providers.gemini).toEqual({
      recommended: "gemini-3-flash",
      fallbacks: ["gemini-2.5-flash"],
    });
    expect(resolved.providers.openai).toEqual(embeddedAiModelCatalog.providers.openai);
  });
});
