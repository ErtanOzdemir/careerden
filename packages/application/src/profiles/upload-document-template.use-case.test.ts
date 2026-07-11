import { describe, expect, it, vi } from "vitest";
import type { DocxTemplateRenderer, FileStorage } from "@link2cv/domain";
import { ApplicationError } from "../application-error.js";
import { createProfileRepository, createTestTemplate } from "./profile-test-helpers.js";
import { UploadDocumentTemplateUseCase } from "./upload-document-template.use-case.js";

describe("UploadDocumentTemplateUseCase", () => {
  it("extracts placeholders, stores the file, and creates the first template as default", async () => {
    const template = createTestTemplate();
    const profiles = createProfileRepository(undefined, template);
    const storage = createStorage();

    await expect(
      new UploadDocumentTemplateUseCase(profiles, storage, createRenderer(["full_name"])).execute({
        profileId: "profile-1",
        userId: "user-1",
        fileName: "cv.docx",
        size: 128,
        body: Buffer.from("template"),
      }),
    ).resolves.toBe(template);
    expect(storage.put).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: "cv.docx",
        metadata: { kind: "cv_template", profileId: "profile-1" },
      }),
    );
    expect(profiles.createDocumentTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ placeholders: ["full_name"], isDefault: true }),
    );
  });

  it("rejects a template without placeholders before storing it", async () => {
    const profiles = createProfileRepository();
    const storage = createStorage();

    await expect(
      new UploadDocumentTemplateUseCase(profiles, storage, createRenderer([])).execute({
        profileId: "profile-1",
        userId: "user-1",
        fileName: "cv.docx",
        size: 128,
        body: Buffer.from("template"),
      }),
    ).rejects.toEqual(
      new ApplicationError(
        "validation",
        "DOCX template must include at least one {{placeholder_name}} field",
      ),
    );
    expect(storage.put).not.toHaveBeenCalled();
  });
});

function createStorage(): FileStorage {
  return {
    put: vi.fn(async () => ({
      id: "file-1",
      fileName: "cv.docx",
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: 128,
    })),
    get: vi.fn(),
    getSignedUrl: vi.fn(),
    delete: vi.fn(),
  };
}

function createRenderer(placeholders: string[]): DocxTemplateRenderer {
  return {
    extractPlaceholders: vi.fn(async () => placeholders),
    render: vi.fn(),
  };
}
