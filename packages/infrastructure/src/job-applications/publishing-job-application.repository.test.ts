import { describe, expect, it, vi } from "vitest";
import type { JobApplicationChange } from "@link2cv/domain";
import { InMemoryJobApplicationRepository } from "../persistence/job-applications/in-memory-job-application.repository.js";
import { InMemoryJobApplicationChangeBus } from "./in-memory-job-application-change.bus.js";
import { PublishingJobApplicationRepository } from "./publishing-job-application.repository.js";

describe("PublishingJobApplicationRepository", () => {
  it("publishes profile-scoped changes after successful mutations", async () => {
    const bus = new InMemoryJobApplicationChangeBus();
    const repository = new PublishingJobApplicationRepository(
      new InMemoryJobApplicationRepository(),
      bus,
    );
    const changes: JobApplicationChange[] = [];
    await bus.subscribe("profile-1", (change) => changes.push(change));

    const application = await repository.create({
      profileId: "profile-1",
      sourceUrl: "https://www.linkedin.com/jobs/view/123",
    });
    await repository.updateStatus(application.id, "scraping");
    await repository.updateTracking(application.id, { companyName: "Acme" });
    await repository.deleteById(application.id);

    expect(changes.map((change) => change.type)).toEqual([
      "application.changed",
      "application.changed",
      "application.changed",
      "application.deleted",
    ]);
    expect(changes.every((change) => change.profileId === "profile-1")).toBe(true);
    expect(changes.every((change) => change.applicationId === application.id)).toBe(true);
  });

  it("does not publish when the wrapped mutation fails", async () => {
    const bus = new InMemoryJobApplicationChangeBus();
    const repository = new PublishingJobApplicationRepository(
      new InMemoryJobApplicationRepository(),
      bus,
    );
    const changes: JobApplicationChange[] = [];
    await bus.subscribe("profile-1", (change) => changes.push(change));

    await expect(repository.updateStatus("missing", "failed")).rejects.toThrow(
      "Job application missing was not found",
    );
    expect(changes).toEqual([]);
  });

  it("does not fail a committed mutation when realtime publication fails", async () => {
    const baseRepository = new InMemoryJobApplicationRepository();
    const repository = new PublishingJobApplicationRepository(baseRepository, {
      publish: async () => {
        throw new Error("Realtime channel unavailable");
      },
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const application = await repository.create({ profileId: "profile-1" });

    expect(await repository.findById(application.id)).toMatchObject({ id: application.id });
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to publish job application realtime change",
      expect.any(Error),
    );
    consoleError.mockRestore();
  });

  it("delivers events only to subscribers for the matching profile", async () => {
    const bus = new InMemoryJobApplicationChangeBus();
    const firstProfile: JobApplicationChange[] = [];
    const secondProfile: JobApplicationChange[] = [];
    await bus.subscribe("profile-1", (change) => firstProfile.push(change));
    await bus.subscribe("profile-2", (change) => secondProfile.push(change));

    await bus.publish({
      type: "application.changed",
      applicationId: "application-1",
      profileId: "profile-1",
      occurredAt: new Date().toISOString(),
    });

    expect(firstProfile).toHaveLength(1);
    expect(secondProfile).toHaveLength(0);
  });
});
