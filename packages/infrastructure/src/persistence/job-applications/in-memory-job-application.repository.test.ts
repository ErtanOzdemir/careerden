import { describe, expect, it } from "vitest";
import { richDocumentFromText } from "@link2cv/domain";
import { InMemoryJobApplicationRepository } from "./in-memory-job-application.repository.js";

describe("InMemoryJobApplicationRepository", () => {
  it("stores the latest editable document content", async () => {
    const repository = new InMemoryJobApplicationRepository();
    const job = await repository.create({
      profileId: "profile-1",
      sourceUrl: "https://www.linkedin.com/jobs/view/1",
    });
    const first = {
      customizedSummary: richDocumentFromText("AI summary"),
      experienceEnhancements: [],
    };
    const edited = {
      customizedSummary: richDocumentFromText("User-edited summary"),
      experienceEnhancements: [],
    };

    await repository.saveDocumentContent(job.id, first);
    await repository.saveDocumentContent(job.id, edited);

    expect(await repository.getDocumentContent(job.id)).toEqual(edited);
  });

  it("resets processing artifacts while preserving tracking data", async () => {
    const repository = new InMemoryJobApplicationRepository();
    const job = await repository.create({
      profileId: "profile-1",
      sourceUrl: "https://www.linkedin.com/jobs/view/123",
      companyName: "Stripe",
      roleTitle: "Senior Product Designer",
    });
    await repository.updateStatus(job.id, "failed", "Scraping failed");
    await repository.attachGeneratedDocument({
      jobApplicationId: job.id,
      kind: "cv",
      format: "pdf",
      fileId: "files/cv.pdf",
      fileName: "cv.pdf",
      contentType: "application/pdf",
    });

    const reset = await repository.resetProcessing(job.id);

    expect(reset.status).toBe("queued");
    expect(reset.failureReason).toBeUndefined();
    expect(reset.tracking.companyName).toBe("Stripe");
    expect(await repository.listGeneratedDocuments(job.id)).toEqual([]);
  });

  it("deletes a job application and all related records", async () => {
    const repository = new InMemoryJobApplicationRepository();
    const job = await repository.create({
      profileId: "profile-1",
      companyName: "Stripe",
      roleTitle: "Senior Product Designer",
    });

    await repository.createContact({
      jobApplicationId: job.id,
      name: "Sarah Hughes",
    });
    await repository.createInterview({
      jobApplicationId: job.id,
      title: "Recruiter Call",
      scheduledAt: new Date("2026-06-20T12:00:00.000Z"),
    });
    await repository.attachGeneratedDocument({
      jobApplicationId: job.id,
      kind: "cv",
      format: "pdf",
      fileId: "files/cv.pdf",
      fileName: "cv.pdf",
      contentType: "application/pdf",
    });

    await repository.deleteById(job.id);

    expect(await repository.findById(job.id)).toBeNull();
    expect(await repository.listEvents(job.id)).toEqual([]);
    expect(await repository.listContacts(job.id)).toEqual([]);
    expect(await repository.listInterviews(job.id)).toEqual([]);
    expect(await repository.listGeneratedDocuments(job.id)).toEqual([]);
  });

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

  it("overwrites generated documents of the same kind and format per job application", async () => {
    const repository = new InMemoryJobApplicationRepository();
    const job = await repository.create({
      profileId: "profile-1",
      companyName: "Stripe",
      roleTitle: "Senior Product Designer",
    });

    const first = await repository.attachGeneratedDocument({
      jobApplicationId: job.id,
      kind: "cv",
      format: "pdf",
      fileId: "files/first-cv.pdf",
      fileName: "cv.pdf",
      contentType: "application/pdf",
    });
    const second = await repository.attachGeneratedDocument({
      jobApplicationId: job.id,
      kind: "cv",
      format: "pdf",
      fileId: "files/regenerated-cv.pdf",
      fileName: "cv.pdf",
      contentType: "application/pdf",
    });
    const docx = await repository.attachGeneratedDocument({
      jobApplicationId: job.id,
      kind: "cv",
      format: "docx",
      fileId: "files/generated-cv.docx",
      fileName: "cv.docx",
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    expect(second.id).toBe(first.id);
    expect(await repository.listGeneratedDocuments(job.id)).toEqual([second, docx]);
    expect(second.fileId).toBe("files/regenerated-cv.pdf");
  });
});
