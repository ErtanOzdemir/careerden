import { describe, expect, it } from "vitest";
import type { ApiDocumentTemplate } from "../api/types.js";
import { hasValidCoverLetterTemplateMapping } from "./document-template.js";

const template: ApiDocumentTemplate = {
  id: "template-1",
  profileId: "profile-1",
  kind: "cover_letter",
  format: "docx",
  fileId: "file-1",
  fileName: "cover-letter.docx",
  contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  size: 128,
  placeholders: ["letter_body", "name"],
  fieldMappings: { letter_body: "cover_letter_content" },
  variableAliases: { fields: {} },
  isDefault: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("hasValidCoverLetterTemplateMapping", () => {
  it("accepts only one Content mapping without aliases", () => {
    expect(hasValidCoverLetterTemplateMapping(template)).toBe(true);
  });

  it("rejects additional mappings", () => {
    expect(
      hasValidCoverLetterTemplateMapping({
        ...template,
        fieldMappings: {
          letter_body: "cover_letter_content",
          name: "full_name",
        },
      }),
    ).toBe(false);
  });

  it("rejects variable aliases", () => {
    expect(
      hasValidCoverLetterTemplateMapping({
        ...template,
        variableAliases: { fields: { full_name: "name" } },
      }),
    ).toBe(false);
  });
});
