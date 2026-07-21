import { describe, expect, it, vi } from "vitest";
import type { JobApplicationRepository, PersistenceUnitOfWork } from "@careerden/domain";
import { createProfileRepository, createTestTemplate } from "./profile-test-helpers.js";
import { DeleteDocumentTemplateUseCase } from "./delete-document-template.use-case.js";

describe("DeleteDocumentTemplateUseCase", () => {
  it("deletes the template, clears saved selections, and schedules file cleanup", async () => {
    const template = createTestTemplate({ kind: "cv", isDefault: true });
    const profiles = createProfileRepository(undefined, template);
    const { unitOfWork, clearSelection, addOutboxEvent, recordChanged } =
      createUnitOfWork(profiles);
    clearSelection.mockResolvedValue(["application-1", "application-2"]);

    await expect(
      new DeleteDocumentTemplateUseCase(unitOfWork).execute(
        template.profileId,
        template.id,
        "user-1",
      ),
    ).resolves.toBeUndefined();

    expect(profiles.deleteDocumentTemplate).toHaveBeenCalledWith(template.id);
    expect(clearSelection).toHaveBeenCalledWith(template.profileId, template.kind, template.id);
    expect(addOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "storage.delete",
        aggregateId: template.fileId,
        payload: { fileId: template.fileId },
      }),
    );
    expect(recordChanged).toHaveBeenCalledTimes(2);
    expect(recordChanged).toHaveBeenCalledWith("application-1", template.profileId);
    expect(recordChanged).toHaveBeenCalledWith("application-2", template.profileId);
  });

  it("hides templates owned by another user", async () => {
    const profiles = createProfileRepository();
    vi.mocked(profiles.findUserIdByProfileId).mockResolvedValue("user-2");
    const { unitOfWork, clearSelection, addOutboxEvent } = createUnitOfWork(profiles);

    await expect(
      new DeleteDocumentTemplateUseCase(unitOfWork).execute("profile-1", "template-1", "user-1"),
    ).rejects.toMatchObject({ code: "not_found" });

    expect(profiles.deleteDocumentTemplate).not.toHaveBeenCalled();
    expect(clearSelection).not.toHaveBeenCalled();
    expect(addOutboxEvent).not.toHaveBeenCalled();
  });

  it("reports a template removed by a concurrent request", async () => {
    const profiles = createProfileRepository();
    vi.mocked(profiles.deleteDocumentTemplate).mockResolvedValue(false);
    const { unitOfWork, clearSelection, addOutboxEvent } = createUnitOfWork(profiles);

    await expect(
      new DeleteDocumentTemplateUseCase(unitOfWork).execute("profile-1", "template-1", "user-1"),
    ).rejects.toMatchObject({ code: "not_found" });

    expect(clearSelection).not.toHaveBeenCalled();
    expect(addOutboxEvent).not.toHaveBeenCalled();
  });
});

function createUnitOfWork(profiles: ReturnType<typeof createProfileRepository>): {
  unitOfWork: PersistenceUnitOfWork;
  clearSelection: ReturnType<typeof vi.fn>;
  addOutboxEvent: ReturnType<typeof vi.fn>;
  recordChanged: ReturnType<typeof vi.fn>;
} {
  const clearSelection = vi.fn<JobApplicationRepository["clearApplicationPackTemplateSelection"]>(
    async () => [],
  );
  const addOutboxEvent = vi.fn(async (input) => ({
    ...input,
    id: "outbox-1",
    attemptCount: 0,
  }));
  const recordChanged = vi.fn();

  return {
    clearSelection,
    addOutboxEvent,
    recordChanged,
    unitOfWork: {
      execute: async (work) =>
        work({
          jobApplications: { clearApplicationPackTemplateSelection: clearSelection } as never,
          jobApplicationChanges: { changed: recordChanged } as never,
          profiles,
          notifications: {} as never,
          notificationChanges: {} as never,
          followUpReminders: {} as never,
          outbox: { add: addOutboxEvent },
        }),
    },
  };
}
