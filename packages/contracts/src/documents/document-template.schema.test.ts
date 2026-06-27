import { describe, expect, it } from "vitest";
import { documentTemplateVariableAliasesSchema } from "./document-template.schema";

describe("document template schema", () => {
  it("accepts summary as a profile template variable field", () => {
    expect(
      documentTemplateVariableAliasesSchema.parse({
        fields: {
          summary: "profile_description",
        },
      }),
    ).toEqual({
      fields: {
        summary: "profile_description",
      },
    });
  });
});
