import { describe, expect, it } from "vitest";
import { richDocumentFromText, type ScrapeBundle } from "@careerden/domain";
import { InMemoryJobApplicationRepository } from "./in-memory-job-application.repository.js";

describe("InMemoryJobApplicationRepository", () => {
  it("defaults and preserves application-pack preferences", async () => {
    const repository = new InMemoryJobApplicationRepository();
    const defaults = await repository.create({ profileId: "profile-1" });
    const customized = await repository.create({
      profileId: "profile-1",
      applicationPackPreferences: {
        language: "tr-TR",
        tone: "creative",
        coverLetterTemplateId: "cover-template",
      },
    });

    expect(defaults.applicationPackPreferences).toEqual({
      language: "auto",
      tone: "professional",
    });
    expect(customized.applicationPackPreferences).toEqual({
      language: "tr-TR",
      tone: "creative",
      coverLetterTemplateId: "cover-template",
    });
  });

  it("clears only matching application-pack template selections", async () => {
    const repository = new InMemoryJobApplicationRepository();
    const affected = await repository.create({
      profileId: "profile-1",
      applicationPackPreferences: {
        language: "tr-TR",
        tone: "creative",
        cvTemplateId: "cv-template",
        coverLetterTemplateId: "cover-template",
      },
    });
    const otherTemplate = await repository.create({
      profileId: "profile-1",
      applicationPackPreferences: {
        language: "en",
        tone: "concise",
        cvTemplateId: "other-template",
      },
    });
    await repository.create({
      profileId: "profile-2",
      applicationPackPreferences: {
        language: "de",
        tone: "professional",
        cvTemplateId: "cv-template",
      },
    });

    await expect(
      repository.clearApplicationPackTemplateSelection("profile-1", "cv", "cv-template"),
    ).resolves.toEqual([affected.id]);
    await expect(repository.findById(affected.id)).resolves.toMatchObject({
      applicationPackPreferences: {
        language: "tr-TR",
        tone: "creative",
        coverLetterTemplateId: "cover-template",
      },
    });
    await expect(repository.findById(otherTemplate.id)).resolves.toMatchObject({
      applicationPackPreferences: {
        cvTemplateId: "other-template",
      },
    });
  });

  it("filters, sorts, and paginates applications with a total count", async () => {
    const repository = new InMemoryJobApplicationRepository();
    const lowMatch = await repository.create({
      profileId: "profile-1",
      companyName: "Acme",
      roleTitle: "Engineer",
    });
    const highMatch = await repository.create({
      profileId: "profile-1",
      companyName: "Beta",
      roleTitle: "Engineer",
    });
    await repository.create({ profileId: "profile-2", companyName: "Other" });
    await repository.saveMatchAnalysis(lowMatch.id, {
      matchScore: 45,
      missingSkills: [],
      strongSkills: [],
      suggestedSummary: "",
    });
    await repository.saveMatchAnalysis(highMatch.id, {
      matchScore: 90,
      missingSkills: [],
      strongSkills: [],
      suggestedSummary: "",
    });

    const firstPage = await repository.listByProfileId("profile-1", {
      processingStatuses: ["completed"],
      sortBy: "matchScore",
      sortDirection: "desc",
      page: 1,
      pageSize: 1,
    });
    const secondPage = await repository.listByProfileId("profile-1", {
      processingStatuses: ["completed"],
      sortBy: "matchScore",
      sortDirection: "desc",
      page: 2,
      pageSize: 1,
    });

    expect(firstPage).toMatchObject({ totalItems: 2, items: [{ id: highMatch.id }] });
    expect(secondPage).toMatchObject({ totalItems: 2, items: [{ id: lowMatch.id }] });
  });

  it("creates applications without interest and supports setting and clearing it", async () => {
    const repository = new InMemoryJobApplicationRepository();
    const job = await repository.create({ profileId: "profile-1" });

    expect(job.tracking.priority).toBeUndefined();

    const interested = await repository.updateTracking(job.id, { priority: "high" });
    expect(interested.tracking.priority).toBe("high");

    const cleared = await repository.updateTracking(job.id, { priority: null });
    expect(cleared.tracking.priority).toBeUndefined();
  });

  it("updates and clears work style tracking", async () => {
    const repository = new InMemoryJobApplicationRepository();
    const job = await repository.create({ profileId: "profile-1" });

    const updated = await repository.updateTracking(job.id, { workStyle: "remote" });
    expect(updated.tracking.workStyle).toBe("remote");

    const cleared = await repository.updateTracking(job.id, { workStyle: null });
    expect(cleared.tracking.workStyle).toBeUndefined();
  });

  it("updates and clears salary tracking fields", async () => {
    const repository = new InMemoryJobApplicationRepository();
    const job = await repository.create({ profileId: "profile-1" });

    const updated = await repository.updateTracking(job.id, {
      salaryMinAmount: 90_000,
      salaryMaxAmount: 120_000,
      salaryCurrency: "EUR",
      salaryPeriod: "yearly",
      salaryType: "gross",
    });
    expect(updated.tracking).toMatchObject({
      salaryMinAmount: 90_000,
      salaryMaxAmount: 120_000,
      salaryCurrency: "EUR",
      salaryPeriod: "yearly",
      salaryType: "gross",
    });

    const cleared = await repository.updateTracking(job.id, {
      salaryMinAmount: null,
      salaryMaxAmount: null,
      salaryCurrency: null,
      salaryPeriod: null,
      salaryType: null,
    });
    expect(cleared.tracking.salaryMinAmount).toBeUndefined();
    expect(cleared.tracking.salaryMaxAmount).toBeUndefined();
    expect(cleared.tracking.salaryCurrency).toBeUndefined();
    expect(cleared.tracking.salaryPeriod).toBeUndefined();
    expect(cleared.tracking.salaryType).toBeUndefined();
  });

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

  it("resets AI analysis artifacts while preserving the scrape bundle", async () => {
    const repository = new InMemoryJobApplicationRepository();
    const job = await repository.create({
      profileId: "profile-1",
      sourceUrl: "https://www.linkedin.com/jobs/view/123",
    });
    const scrape = createScrapeBundle();
    await repository.saveScrapeBundle(job.id, scrape);
    await repository.saveMatchAnalysis(job.id, {
      matchScore: 77,
      missingSkills: ["GraphQL"],
      strongSkills: ["TypeScript"],
      recommendedAchievements: [],
      customizedSummary: "Backend engineer",
      interviewTips: [],
    });
    await repository.saveDocumentContent(job.id, {
      customizedSummary: richDocumentFromText("Backend engineer"),
      experienceEnhancements: [],
    });
    await repository.attachGeneratedDocument({
      jobApplicationId: job.id,
      kind: "cv",
      format: "pdf",
      fileId: "files/cv.pdf",
      fileName: "cv.pdf",
      contentType: "application/pdf",
    });
    await repository.updateStatus(job.id, "failed", "AI failed");

    const reset = await repository.resetAnalysis(job.id);

    expect(reset.status).toBe("scraped");
    expect(reset.failureReason).toBeUndefined();
    expect(await repository.getScrapeBundle(job.id)).toEqual(scrape);
    expect(await repository.getMatchAnalysis(job.id)).toBeNull();
    expect(await repository.getDocumentContent(job.id)).toBeNull();
    expect(await repository.listGeneratedDocuments(job.id)).toEqual([]);
  });

  it("starts document regeneration from failed and clears the failure reason", async () => {
    const repository = new InMemoryJobApplicationRepository();
    const job = await repository.create({ profileId: "profile-1" });
    await repository.updateStatus(job.id, "failed", "DOCX rendering failed");

    const result = await repository.beginDocumentGeneration(job.id, "attempt-2");

    expect(result).toEqual({ started: true });
    expect(await repository.findById(job.id)).toMatchObject({
      status: "generating_documents",
      failureReason: undefined,
    });
  });

  it("claims one queued scrape job and prevents concurrent claims until the lease expires", async () => {
    const repository = new InMemoryJobApplicationRepository();
    const first = await repository.create({
      profileId: "profile-1",
      sourceUrl: "https://www.linkedin.com/jobs/view/1",
    });
    await repository.create({
      profileId: "profile-2",
      sourceUrl: "https://www.linkedin.com/jobs/view/2",
    });

    const claimed = await repository.claimNextScrapeJob({
      profileId: "profile-1",
      claimedBy: "desktop-a",
      claimDurationMs: 60_000,
      now: new Date("2026-06-30T10:00:00.000Z"),
    });

    expect(claimed?.id).toBe(first.id);
    expect(claimed?.status).toBe("scraping");
    expect(claimed?.scrapeClaimedBy).toBe("desktop-a");
    expect(claimed?.scrapeClaimExpiresAt?.toISOString()).toBe("2026-06-30T10:01:00.000Z");

    await expect(
      repository.claimNextScrapeJob({
        profileId: "profile-1",
        claimedBy: "desktop-b",
        claimDurationMs: 60_000,
        now: new Date("2026-06-30T10:00:30.000Z"),
      }),
    ).resolves.toBeNull();

    const reclaimed = await repository.claimNextScrapeJob({
      profileId: "profile-1",
      claimedBy: "desktop-b",
      claimDurationMs: 60_000,
      now: new Date("2026-06-30T10:01:01.000Z"),
    });

    expect(reclaimed?.id).toBe(first.id);
    expect(reclaimed?.scrapeClaimedBy).toBe("desktop-b");
  });

  it("skips queued scrape jobs until their retry backoff has elapsed", async () => {
    const repository = new InMemoryJobApplicationRepository();
    const job = await repository.create({
      profileId: "profile-1",
      sourceUrl: "https://www.linkedin.com/jobs/view/1",
    });
    await repository.claimNextScrapeJob({
      profileId: "profile-1",
      claimedBy: "desktop-a",
      claimDurationMs: 600_000,
      now: new Date("2026-06-30T10:00:00.000Z"),
    });
    await repository.recordScrapeFailure(job.id, {
      claimedBy: "desktop-a",
      reason: "LinkedIn session expired",
      maxAttempts: 3,
      backoffMs: 60_000,
      now: new Date("2026-06-30T10:00:10.000Z"),
    });

    await expect(
      repository.claimNextScrapeJob({
        profileId: "profile-1",
        claimedBy: "desktop-b",
        claimDurationMs: 600_000,
        now: new Date("2026-06-30T10:00:30.000Z"),
      }),
    ).resolves.toBeNull();

    const reclaimed = await repository.claimNextScrapeJob({
      profileId: "profile-1",
      claimedBy: "desktop-b",
      claimDurationMs: 600_000,
      now: new Date("2026-06-30T10:01:11.000Z"),
    });

    expect(reclaimed?.id).toBe(job.id);
    expect(reclaimed?.scrapeAttemptCount).toBe(2);
  });

  it("renews a scrape claim only for the owning desktop instance", async () => {
    const repository = new InMemoryJobApplicationRepository();
    const job = await repository.create({
      profileId: "profile-1",
      sourceUrl: "https://www.linkedin.com/jobs/view/1",
    });
    await repository.claimNextScrapeJob({
      profileId: "profile-1",
      claimedBy: "desktop-a",
      claimDurationMs: 600_000,
      now: new Date("2026-06-30T10:00:00.000Z"),
    });

    await expect(
      repository.renewScrapeClaim(job.id, {
        claimedBy: "desktop-b",
        claimDurationMs: 600_000,
        now: new Date("2026-06-30T10:01:00.000Z"),
      }),
    ).resolves.toBeNull();

    const renewed = await repository.renewScrapeClaim(job.id, {
      claimedBy: "desktop-a",
      claimDurationMs: 600_000,
      now: new Date("2026-06-30T10:01:00.000Z"),
    });

    expect(renewed?.scrapeClaimExpiresAt?.toISOString()).toBe("2026-06-30T10:11:00.000Z");
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
    await repository.createFollowUp({
      jobApplicationId: job.id,
      profileId: "profile-1",
      title: "Follow up next week",
      scheduledAt: new Date("2026-07-15T09:00:00.000Z"),
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
    expect(await repository.listFollowUps(job.id)).toEqual([]);
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

  it("replaces obsolete generated formats when a template choice changes", async () => {
    const repository = new InMemoryJobApplicationRepository();
    const job = await repository.create({ profileId: "profile-1" });
    await repository.attachGeneratedDocument({
      jobApplicationId: job.id,
      kind: "cover_letter",
      format: "pdf",
      fileId: "files/cover-letter.pdf",
      fileName: "cover-letter.pdf",
      contentType: "application/pdf",
    });

    const replacements = await repository.replaceGeneratedDocuments(job.id, [
      {
        kind: "cover_letter",
        format: "docx",
        fileId: "files/cover-letter.docx",
        fileName: "cover-letter.docx",
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    ]);

    expect(await repository.listGeneratedDocuments(job.id)).toEqual(replacements);
    expect(replacements).toEqual([
      expect.objectContaining({ kind: "cover_letter", format: "docx" }),
    ]);
  });

  it("manages follow-ups for a job application", async () => {
    const repository = new InMemoryJobApplicationRepository();
    const job = await repository.create({
      profileId: "profile-1",
      companyName: "Stripe",
      roleTitle: "Senior Product Designer",
    });

    const followUp = await repository.createFollowUp({
      jobApplicationId: job.id,
      profileId: "profile-1",
      title: "Send thank-you email",
      description: "Follow up after the phone screen.",
      scheduledAt: new Date("2026-07-15T09:00:00.000Z"),
    });
    const updated = await repository.updateFollowUp(followUp.id, {
      title: "Check on application status",
      description: null,
    });

    expect(updated.title).toBe("Check on application status");
    expect(updated.description).toBeUndefined();
    expect(await repository.listFollowUps(job.id)).toEqual([updated]);

    await repository.deleteFollowUp(followUp.id);

    expect(await repository.listFollowUps(job.id)).toEqual([]);
  });
});

function createScrapeBundle(): ScrapeBundle {
  return {
    job: {
      title: "Backend Engineer",
      companyName: "Example Inc",
      description: "Build TypeScript services",
      requirements: ["TypeScript"],
      raw: {},
    },
  };
}
