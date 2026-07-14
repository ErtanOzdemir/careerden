import { describe, expect, it } from "vitest";
import { createProfileRepository, createTestTemplate } from "./profile-test-helpers.js";
import { UpdateDocumentTemplateVariableAliasesUseCase } from "./update-document-template-variable-aliases.use-case.js";

describe("UpdateDocumentTemplateVariableAliasesUseCase", () => {
  it("rejects variable aliases for a cover letter template", async () => {
    const profiles = createProfileRepository(
      undefined,
      createTestTemplate({ kind: "cover_letter" }),
    );
    const useCase = new UpdateDocumentTemplateVariableAliasesUseCase(profiles);

    await expect(
      useCase.execute("profile-1", "template-1", "user-1", {
        fields: { full_name: "name" },
      }),
    ).rejects.toMatchObject({
      code: "validation",
      message: "Cover letter templates only support the mapped content placeholder",
    });

    expect(profiles.updateDocumentTemplateVariableAliases).not.toHaveBeenCalled();
  });

  it("allows empty aliases so obsolete cover letter mappings can be cleared", async () => {
    const template = createTestTemplate({ kind: "cover_letter" });
    const profiles = createProfileRepository(undefined, template);
    const useCase = new UpdateDocumentTemplateVariableAliasesUseCase(profiles);

    await expect(
      useCase.execute("profile-1", "template-1", "user-1", { fields: {} }),
    ).resolves.toBe(template);

    expect(profiles.updateDocumentTemplateVariableAliases).toHaveBeenCalledWith("template-1", {
      fields: {},
    });
  });
});
