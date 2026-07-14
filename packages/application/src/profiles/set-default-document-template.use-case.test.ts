import { describe, expect, it } from "vitest";
import { createProfileRepository, createTestTemplate } from "./profile-test-helpers.js";
import { SetDefaultDocumentTemplateUseCase } from "./set-default-document-template.use-case.js";

describe("SetDefaultDocumentTemplateUseCase", () => {
  it("rejects an unmapped cover letter template", async () => {
    const template = createTestTemplate({
      kind: "cover_letter",
      placeholders: ["letter_body"],
      isDefault: false,
    });
    const profiles = createProfileRepository(undefined, template);

    await expect(
      new SetDefaultDocumentTemplateUseCase(profiles).execute("profile-1", "template-1", "user-1"),
    ).rejects.toMatchObject({ code: "validation" });
    expect(profiles.setDefaultDocumentTemplate).not.toHaveBeenCalled();
  });

  it("activates a cover letter template after Content is mapped", async () => {
    const template = createTestTemplate({
      kind: "cover_letter",
      placeholders: ["letter_body"],
      fieldMappings: { letter_body: "cover_letter_content" },
      isDefault: false,
    });
    const profiles = createProfileRepository(undefined, template);

    await new SetDefaultDocumentTemplateUseCase(profiles).execute(
      "profile-1",
      "template-1",
      "user-1",
    );

    expect(profiles.setDefaultDocumentTemplate).toHaveBeenCalledWith("profile-1", "template-1");
  });
});
