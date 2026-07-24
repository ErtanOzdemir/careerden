import { describe, expect, it, vi } from "vitest";
import {
  InvalidDocxTemplateError,
  type DocxTemplateRenderer,
  type FileStorage,
  type PersistenceUnitOfWork,
} from "@careerden/domain";
import { ApplicationError } from "../application-error.js";
import { createProfileRepository, createTestTemplate } from "./profile-test-helpers.js";
import { UploadDocumentTemplateUseCase } from "./upload-document-template.use-case.js";

describe("UploadDocumentTemplateUseCase", () => {
  it("extracts placeholders, stores the file, and creates the first template as default", async () => {
    const template = createTestTemplate();
    const profiles = createProfileRepository(undefined, template);
    const storage = createStorage();
    const { unitOfWork } = createUnitOfWork(profiles);

    await expect(
      new UploadDocumentTemplateUseCase(
        profiles,
        storage,
        createRenderer(["full_name"]),
        unitOfWork,
      ).execute({
        kind: "cv",
        profileId: "profile-1",
        userId: "user-1",
        fileName: "cv.docx",
        size: 128,
        body: Buffer.from("template"),
      }),
    ).resolves.toBe(template);
    expect(storage.put).toHaveBeenCalledWith(
      expect.objectContaining({
        key: expect.stringMatching(/^profiles\/profile-1\/document-templates\/.+\/cv\.docx$/),
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
    const { unitOfWork } = createUnitOfWork(profiles);

    await expect(
      new UploadDocumentTemplateUseCase(profiles, storage, createRenderer([]), unitOfWork).execute({
        kind: "cv",
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

  it("maps unsafe DOCX archives to a validation error before storing them", async () => {
    const profiles = createProfileRepository();
    const storage = createStorage();
    const { unitOfWork } = createUnitOfWork(profiles);
    const renderer = createRenderer([]);
    vi.mocked(renderer.extractPlaceholders).mockRejectedValue(
      new InvalidDocxTemplateError("Invalid DOCX template: expanded archive exceeds the limit"),
    );

    await expect(
      new UploadDocumentTemplateUseCase(profiles, storage, renderer, unitOfWork).execute({
        kind: "cv",
        profileId: "profile-1",
        userId: "user-1",
        fileName: "cv.docx",
        size: 128,
        body: Buffer.from("unsafe template"),
      }),
    ).rejects.toEqual(
      new ApplicationError(
        "validation",
        "Invalid DOCX template: expanded archive exceeds the limit",
      ),
    );
    expect(storage.put).not.toHaveBeenCalled();
  });

  it("stores a cover letter template without activating it before Content is mapped", async () => {
    const template = createTestTemplate({ kind: "cover_letter", isDefault: false });
    const profiles = createProfileRepository(undefined, template);
    const storage = createStorage();
    const { unitOfWork } = createUnitOfWork(profiles);

    await new UploadDocumentTemplateUseCase(
      profiles,
      storage,
      createRenderer(["letter_body"]),
      unitOfWork,
    ).execute({
      kind: "cover_letter",
      profileId: "profile-1",
      userId: "user-1",
      fileName: "cover-letter.docx",
      size: 128,
      body: Buffer.from("template"),
    });

    expect(storage.put).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { kind: "cover_letter_template", profileId: "profile-1" },
      }),
    );
    expect(profiles.createDocumentTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "cover_letter",
        placeholders: ["letter_body"],
        isDefault: false,
      }),
    );
  });

  it("durably schedules uploaded-file cleanup when template persistence fails", async () => {
    const profiles = createProfileRepository();
    vi.mocked(profiles.createDocumentTemplate).mockRejectedValue(new Error("database unavailable"));
    const storage = createStorage();
    const { unitOfWork, addOutboxEvent } = createUnitOfWork(profiles);

    await expect(
      new UploadDocumentTemplateUseCase(
        profiles,
        storage,
        createRenderer(["full_name"]),
        unitOfWork,
      ).execute({
        kind: "cv",
        profileId: "profile-1",
        userId: "user-1",
        fileName: "cv.docx",
        size: 128,
        body: Buffer.from("template"),
      }),
    ).rejects.toThrow("database unavailable");

    expect(addOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "storage.delete", payload: { fileId: "file-1" } }),
    );
  });
});

function createUnitOfWork(profiles: ReturnType<typeof createProfileRepository>): {
  unitOfWork: PersistenceUnitOfWork;
  addOutboxEvent: ReturnType<typeof vi.fn>;
} {
  const addOutboxEvent = vi.fn(async (input) => ({ ...input, id: "outbox-1", attemptCount: 0 }));
  return {
    addOutboxEvent,
    unitOfWork: {
      execute: async (work) =>
        work({
          credits: {} as never,
          jobApplications: {} as never,
          jobApplicationChanges: {} as never,
          profiles,
          notifications: {} as never,
          notificationChanges: {} as never,
          followUpReminders: {} as never,
          outbox: { add: addOutboxEvent },
        }),
    },
  };
}

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
    isPlaceholderStandalone: vi.fn(async () => true),
    render: vi.fn(),
  };
}
