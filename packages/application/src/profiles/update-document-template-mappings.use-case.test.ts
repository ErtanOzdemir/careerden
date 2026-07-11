import { describe, expect, it } from "vitest";
import { createProfileRepository } from "./profile-test-helpers.js";
import { UpdateDocumentTemplateMappingsUseCase } from "./update-document-template-mappings.use-case.js";

describe("UpdateDocumentTemplateMappingsUseCase", () => {
  it("rejects mappings for placeholders absent from the template", async () => {
    const profiles = createProfileRepository();

    await expect(
      new UpdateDocumentTemplateMappingsUseCase(profiles).execute(
        "profile-1",
        "template-1",
        "user-1",
        { missing: "full_name" },
      ),
    ).rejects.toMatchObject({
      code: "validation",
      details: { unknown: ["missing"] },
    });
    expect(profiles.updateDocumentTemplateMappings).not.toHaveBeenCalled();
  });
});
