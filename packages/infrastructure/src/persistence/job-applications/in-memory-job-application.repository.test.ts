import { describe, expect, it } from "vitest";
import { InMemoryJobApplicationRepository } from "./in-memory-job-application.repository.js";

describe("InMemoryJobApplicationRepository", () => {
  it("manages contacts for a job application", async () => {
    const repository = new InMemoryJobApplicationRepository();
    const job = await repository.create({
      profileId: "profile-1",
      companyName: "Stripe",
      roleTitle: "Senior Product Designer",
    });

    const contact = await repository.createContact({
      jobApplicationId: job.id,
      name: "Sarah Hughes",
      role: "Recruitment Lead",
      email: "sarah@example.com",
    });
    const updated = await repository.updateContact(contact.id, {
      role: "Senior Recruiter",
      email: null,
    });

    expect(updated.role).toBe("Senior Recruiter");
    expect(updated.email).toBeUndefined();
    expect(await repository.listContacts(job.id)).toEqual([updated]);

    await repository.deleteContact(contact.id);

    expect(await repository.listContacts(job.id)).toEqual([]);
  });

  it("manages interviews sorted by scheduled time", async () => {
    const repository = new InMemoryJobApplicationRepository();
    const job = await repository.create({
      profileId: "profile-1",
      companyName: "Stripe",
      roleTitle: "Senior Product Designer",
    });

    const later = await repository.createInterview({
      jobApplicationId: job.id,
      title: "Portfolio Review",
      scheduledAt: new Date("2026-06-24T12:00:00.000Z"),
      type: "Technical",
      prepNotes: "Review checkout flow redesign",
    });
    const earlier = await repository.createInterview({
      jobApplicationId: job.id,
      title: "Recruiter Call",
      scheduledAt: new Date("2026-06-20T12:00:00.000Z"),
      status: "completed",
      notes: "Discussed salary expectations",
    });

    expect((await repository.listInterviews(job.id)).map((interview) => interview.id)).toEqual([
      earlier.id,
      later.id,
    ]);

    const updated = await repository.updateInterview(later.id, {
      status: "cancelled",
      prepNotes: null,
    });

    expect(updated.status).toBe("cancelled");
    expect(updated.prepNotes).toBeUndefined();

    await repository.deleteInterview(earlier.id);

    expect((await repository.listInterviews(job.id)).map((interview) => interview.id)).toEqual([
      later.id,
    ]);
  });

  it("overwrites generated documents of the same kind per job application", async () => {
    const repository = new InMemoryJobApplicationRepository();
    const job = await repository.create({
      profileId: "profile-1",
      companyName: "Stripe",
      roleTitle: "Senior Product Designer",
    });

    const first = await repository.attachGeneratedDocument({
      jobApplicationId: job.id,
      kind: "cv",
      fileId: "files/first-cv.pdf",
      fileName: "cv.pdf",
      contentType: "application/pdf",
    });
    const second = await repository.attachGeneratedDocument({
      jobApplicationId: job.id,
      kind: "cv",
      fileId: "files/regenerated-cv.pdf",
      fileName: "cv.pdf",
      contentType: "application/pdf",
    });

    expect(second.id).toBe(first.id);
    expect(await repository.listGeneratedDocuments(job.id)).toEqual([second]);
    expect(second.fileId).toBe("files/regenerated-cv.pdf");
  });
});
