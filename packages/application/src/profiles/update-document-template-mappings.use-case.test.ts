import { describe, expect, it, vi } from "vitest";
import { createProfileRepository, createTestTemplate } from "./profile-test-helpers.js";
import { UpdateDocumentTemplateMappingsUseCase } from "./update-document-template-mappings.use-case.js";

describe("UpdateDocumentTemplateMappingsUseCase", () => {
  it("rejects mappings for placeholders absent from the template", async () => {
    const profiles = createProfileRepository();

    await expect(
      createUseCase(profiles).execute("profile-1", "template-1", "user-1", {
        missing: "full_name",
      }),
    ).rejects.toMatchObject({
      code: "validation",
      details: { unknown: ["missing"] },
    });
    expect(profiles.updateDocumentTemplateMappings).not.toHaveBeenCalled();
  });

  it("accepts exactly one user-selected Content placeholder for a cover letter", async () => {
    const template = createTestTemplate({
      kind: "cover_letter",
      placeholders: ["letter_body", "footer"],
      fieldMappings: { letter_body: "cover_letter_content" },
      isDefault: false,
    });
    const profiles = createProfileRepository(undefined, template);

    await createUseCase(profiles).execute("profile-1", "template-1", "user-1", {
      letter_body: "cover_letter_content",
    });

    expect(profiles.updateDocumentTemplateMappings).toHaveBeenCalledWith("template-1", {
      letter_body: "cover_letter_content",
    });
  });

  it("rejects cover letter fields in addition to Content", async () => {
    const template = createTestTemplate({
      kind: "cover_letter",
      placeholders: ["letter_body", "name"],
      isDefault: false,
    });
    const profiles = createProfileRepository(undefined, template);

    await expect(
      createUseCase(profiles).execute("profile-1", "template-1", "user-1", {
        letter_body: "cover_letter_content",
        name: "full_name",
      }),
    ).rejects.toMatchObject({
      code: "validation",
      message: "Cover letter templates must map exactly one placeholder to cover letter content",
    });

    expect(profiles.updateDocumentTemplateMappings).not.toHaveBeenCalled();
  });

  it("rejects a cover letter mapping without Content", async () => {
    const template = createTestTemplate({
      kind: "cover_letter",
      placeholders: ["name"],
      isDefault: false,
    });
    const profiles = createProfileRepository(undefined, template);

    await expect(
      createUseCase(profiles).execute("profile-1", "template-1", "user-1", { name: "full_name" }),
    ).rejects.toMatchObject({ code: "validation" });
  });

  it("rejects Content mapped to an inline DOCX placeholder", async () => {
    const template = createTestTemplate({
      kind: "cover_letter",
      placeholders: ["company_name_1", "description"],
      isDefault: false,
    });
    const profiles = createProfileRepository(undefined, template);

    await expect(
      createUseCase(profiles, false).execute("profile-1", "template-1", "user-1", {
        company_name_1: "cover_letter_content",
      }),
    ).rejects.toMatchObject({
      code: "validation",
      message:
        'Cover letter Content placeholder "company_name_1" must occupy its own paragraph in the DOCX template',
    });
    expect(profiles.updateDocumentTemplateMappings).not.toHaveBeenCalled();
  });
});

function createUseCase(
  profiles: ReturnType<typeof createProfileRepository>,
  isPlaceholderStandalone = true,
) {
  return new UpdateDocumentTemplateMappingsUseCase(
    profiles,
    {
      get: vi.fn(async () => ({ body: Buffer.from("DOCX") })),
    } as never,
    {
      isPlaceholderStandalone: vi.fn(async () => isPlaceholderStandalone),
    } as never,
  );
}
