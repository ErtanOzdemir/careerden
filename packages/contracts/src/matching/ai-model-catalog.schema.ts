import { z } from "zod";

export const aiProviderNameSchema = z.enum([
  "openai",
  "gemini",
  "deepseek",
  "anthropic",
  "openrouter",
]);

export type AiProviderName = z.infer<typeof aiProviderNameSchema>;

// Provider model ids are short tokens such as "gpt-4.1-mini" or "vendor/model:free".
export const aiModelIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/@-]*$/, "Must be a provider model id");

export const aiProviderModelsSchema = z
  .object({
    /** The model new analyses use unless the user picked one. */
    recommended: aiModelIdSchema,
    /** Tried in order when a model is reported as not found or retired. */
    fallbacks: z.array(aiModelIdSchema).max(10).default([]),
  })
  .strict();

export type AiProviderModels = z.infer<typeof aiProviderModelsSchema>;

/**
 * The remotely updatable `ai-models.json`. Providers that are missing from a remote file keep
 * their embedded defaults, so the file can be trimmed to the providers that changed.
 */
export const aiModelCatalogSchema = z
  .object({
    schemaVersion: z.literal(1),
    providers: z
      .object({
        openai: aiProviderModelsSchema.optional(),
        gemini: aiProviderModelsSchema.optional(),
        deepseek: aiProviderModelsSchema.optional(),
        anthropic: aiProviderModelsSchema.optional(),
        openrouter: aiProviderModelsSchema.optional(),
      })
      .strict(),
  })
  .strict();

export type AiModelCatalog = z.infer<typeof aiModelCatalogSchema>;

export interface ResolvedAiModelCatalog {
  schemaVersion: 1;
  providers: Record<AiProviderName, AiProviderModels>;
}

/**
 * The defaults compiled into each release. They apply when the remote catalog has never been
 * fetched, and to providers it leaves out. Keep them equal to `apps/desktop/ai-models.json`.
 */
export const embeddedAiModelCatalog: ResolvedAiModelCatalog = {
  schemaVersion: 1,
  providers: {
    openai: { recommended: "gpt-4.1-mini", fallbacks: ["gpt-4o-mini"] },
    gemini: { recommended: "gemini-2.5-flash", fallbacks: ["gemini-flash-latest"] },
    deepseek: { recommended: "deepseek-chat", fallbacks: [] },
    anthropic: { recommended: "claude-haiku-5-5", fallbacks: ["claude-haiku-4-5"] },
    openrouter: { recommended: "openrouter/auto", fallbacks: [] },
  },
};

export function parseAiModelCatalog(value: unknown): AiModelCatalog {
  return aiModelCatalogSchema.parse(value);
}

/** Fills providers the catalog leaves out with the embedded defaults. */
export function resolveAiModelCatalog(catalog?: AiModelCatalog): ResolvedAiModelCatalog {
  if (!catalog) return embeddedAiModelCatalog;

  const providers = { ...embeddedAiModelCatalog.providers };
  for (const name of aiProviderNameSchema.options) {
    const models = catalog.providers[name];
    if (models) providers[name] = models;
  }
  return { schemaVersion: 1, providers };
}
