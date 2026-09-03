import { z } from "zod";

/**
 * Identifies a single tailorable CV field, shared across three places that all need to agree on the
 * same identity: the `data-field-ref` markup in the HTML templates, the preview iframe's
 * highlight-on-click channel, and the apply-tip API request body.
 */
export type DocumentFieldRef =
  | { type: "summary" }
  | { type: "experience"; index: number }
  | { type: "education"; index: number }
  | { type: "project"; index: number }
  | { type: "skills" }
  | { type: "certifications" };

export function fieldRefToDomId(ref: DocumentFieldRef): string {
  return ref.type === "summary" || ref.type === "skills" || ref.type === "certifications"
    ? ref.type
    : `${ref.type}-${ref.index}`;
}

export const fieldRefSchema: z.ZodType<DocumentFieldRef> = z.discriminatedUnion("type", [
  z.object({ type: z.literal("summary") }).strict(),
  z.object({ type: z.literal("experience"), index: z.number().int().min(0) }).strict(),
  z.object({ type: z.literal("education"), index: z.number().int().min(0) }).strict(),
  z.object({ type: z.literal("project"), index: z.number().int().min(0) }).strict(),
  z.object({ type: z.literal("skills") }).strict(),
  z.object({ type: z.literal("certifications") }).strict(),
]);
