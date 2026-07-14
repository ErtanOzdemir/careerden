import { describe, expect, it } from "vitest";
import { createTestTemplate } from "./profile-test-helpers.js";
import { hasValidCoverLetterContentMapping } from "./document-template-mapping.js";

describe("hasValidCoverLetterContentMapping", () => {
  it("accepts one mapped Content placeholder without variable aliases", () => {
    expect(
      hasValidCoverLetterContentMapping(
        createTestTemplate({
          kind: "cover_letter",
          placeholders: ["letter_body"],
          fieldMappings: { letter_body: "cover_letter_content" },
        }),
      ),
    ).toBe(true);
  });

  it("rejects an additional mapped field", () => {
    expect(
      hasValidCoverLetterContentMapping(
        createTestTemplate({
          kind: "cover_letter",
          placeholders: ["letter_body", "name"],
          fieldMappings: {
            letter_body: "cover_letter_content",
            name: "full_name",
          },
        }),
      ),
    ).toBe(false);
  });

  it("rejects configured variable aliases", () => {
    expect(
      hasValidCoverLetterContentMapping(
        createTestTemplate({
          kind: "cover_letter",
          placeholders: ["letter_body", "name"],
          fieldMappings: { letter_body: "cover_letter_content" },
          variableAliases: { fields: { full_name: "name" } },
        }),
      ),
    ).toBe(false);
  });
});
