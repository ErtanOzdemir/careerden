import { z } from "zod";

const richTextMarkSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bold") }).strict(),
  z.object({ type: z.literal("italic") }).strict(),
  z.object({ type: z.literal("underline") }).strict(),
  z
    .object({
      type: z.literal("link"),
      href: z
        .string()
        .url()
        .refine((value) => /^https?:\/\//i.test(value), {
          message: "Links must use http or https",
        }),
    })
    .strict(),
]);

const richTextNodeSchema = z
  .object({
    type: z.literal("text"),
    text: z.string().max(20_000),
    marks: z.array(richTextMarkSchema).max(4).optional(),
  })
  .strict();

const alignmentSchema = z.enum(["left", "center", "right", "justify"]);
type RichBlockSchema = z.ZodTypeAny;

const richBlockSchema: RichBlockSchema = z.lazy(() =>
  z.discriminatedUnion("type", [
    z
      .object({
        type: z.literal("paragraph"),
        alignment: alignmentSchema.optional(),
        children: z.array(richTextNodeSchema).max(1_000),
      })
      .strict(),
    z
      .object({
        type: z.literal("heading"),
        level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
        alignment: alignmentSchema.optional(),
        children: z.array(richTextNodeSchema).max(1_000),
      })
      .strict(),
    z
      .object({
        type: z.literal("bulletList"),
        items: z.array(z.object({ blocks: z.array(richBlockSchema).max(100) }).strict()).max(100),
      })
      .strict(),
    z
      .object({
        type: z.literal("orderedList"),
        items: z.array(z.object({ blocks: z.array(richBlockSchema).max(100) }).strict()).max(100),
      })
      .strict(),
    z
      .object({
        type: z.literal("table"),
        rows: z
          .array(
            z
              .object({
                cells: z
                  .array(z.object({ blocks: z.array(richBlockSchema).max(100) }).strict())
                  .max(20),
              })
              .strict(),
          )
          .max(100),
      })
      .strict(),
  ]),
);

export const richDocumentSchema = z
  .object({
    version: z.literal(1),
    blocks: z.array(richBlockSchema).max(500),
  })
  .strict()
  .superRefine((document, context) => {
    if (JSON.stringify(document).length > 250_000) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Rich document exceeds the maximum serialized size",
      });
    }

    if (maximumDepth(document.blocks) > 12) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Rich document nesting is too deep",
      });
    }
  });

const documentContentObjectSchema = z
  .object({
    coverLetterContent: richDocumentSchema.optional(),
    customizedSummary: richDocumentSchema,
    formatVersion: z.literal(2).optional(),
    experienceEnhancements: z
      .array(
        z
          .object({
            experienceIndex: z.number().int().min(0),
            description: richDocumentSchema.optional(),
          })
          .strict(),
      )
      .max(100),
    skillSuggestions: z.array(z.string().min(1)).max(100).default([]),
    educationEnhancements: z
      .array(
        z
          .object({
            educationIndex: z.number().int().min(0),
            description: richDocumentSchema.optional(),
          })
          .strict(),
      )
      .max(100)
      .default([]),
    projectEnhancements: z
      .array(
        z
          .object({
            projectIndex: z.number().int().min(0),
            description: richDocumentSchema.optional(),
          })
          .strict(),
      )
      .max(100)
      .default([]),
    certificationSuggestions: z.array(z.string().min(1)).max(100).default([]),
  })
  .strict();

/**
 * Per-item `achievements` were merged into each description in format version 2 and removed from the
 * schema. The object is `.strict()`, so a browser still running a cached pre-upgrade bundle would
 * get a 400 for sending them; stripping instead keeps those clients working. Safe only because
 * migration 20260806000000 has already merged the stored ones — discarding them here loses nothing.
 */
export const documentContentSchema = z.preprocess(
  stripLegacyAchievements,
  documentContentObjectSchema,
);

function stripLegacyAchievements(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;

  const content = value as Record<string, unknown>;
  const withoutAchievements = (item: unknown): unknown => {
    if (typeof item !== "object" || item === null) return item;
    const { achievements: _achievements, ...rest } = item as Record<string, unknown>;
    return rest;
  };
  const stripEnhancements = (key: string): Record<string, unknown> =>
    Array.isArray(content[key]) ? { [key]: content[key].map(withoutAchievements) } : {};

  return {
    ...content,
    ...stripEnhancements("experienceEnhancements"),
    ...stripEnhancements("educationEnhancements"),
    ...stripEnhancements("projectEnhancements"),
  };
}

export const updateDocumentContentSchema = z
  .object({
    documentContent: documentContentSchema,
  })
  .strict();

export type RichDocumentDto = z.infer<typeof richDocumentSchema>;
export type DocumentContentDto = z.infer<typeof documentContentSchema>;

function maximumDepth(value: unknown, depth = 0): number {
  if (depth > 12 || value === null || typeof value !== "object") {
    return depth;
  }

  const children = Array.isArray(value) ? value : Object.values(value);
  return children.reduce(
    (maximum, child) => Math.max(maximum, maximumDepth(child, depth + 1)),
    depth,
  );
}
