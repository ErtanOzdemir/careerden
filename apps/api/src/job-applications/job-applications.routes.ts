import { Router } from "express";
import type { Request, Router as ExpressRouter } from "express";
import type {
  DeleteJobApplicationUseCase,
  GenerateDocumentsWithAiUseCase,
  GenerateJobApplicationDocumentsUseCase,
  RetryJobApplicationUseCase,
  SubmitJobApplicationUseCase,
  UpdateDocumentContentUseCase,
} from "@link2cv/application";
import type {
  FileStorage,
  DocumentContent,
  GeneratedDocument,
  JobApplication,
  JobApplicationContact,
  JobApplicationEvent,
  JobApplicationInterview,
  JobApplicationChangeSubscriber,
  JobApplicationQueue,
  JobApplicationRepository,
  MatchAnalysisResult,
  ScrapeBundle,
  UserProfile,
} from "@link2cv/domain";
import { canTransitionJobApplicationStatus } from "@link2cv/domain";
import {
  createJobApplicationFromScrapeSchema,
  createJobApplicationContactSchema,
  createJobApplicationEventSchema,
  createJobApplicationInterviewSchema,
  createJobApplicationSchema,
  jobApplicationAnalyticsQuerySchema,
  listJobApplicationsQuerySchema,
  submitScrapeDataSchema,
  updateJobApplicationContactSchema,
  updateJobApplicationInterviewSchema,
  updateJobApplicationSchema,
  updateStatusSchema,
  updateDocumentContentSchema,
} from "@link2cv/contracts";
import { validateBody } from "../middleware/validate-body.js";
import type { AuthenticatedRequest } from "../auth/session.middleware.js";

export type JobApplicationWithDocuments = JobApplication & {
  documents: GeneratedDocument[];
  companyLogoUrl?: string;
  matchScore?: number;
};

export type JobApplicationDetail = JobApplicationWithDocuments & {
  events: JobApplicationEvent[];
  contacts: JobApplicationContact[];
  interviews: JobApplicationInterview[];
  scrapeBundle: ScrapeBundle | null;
  matchAnalysis: MatchAnalysisResult | null;
  documentContent: DocumentContent | null;
};

export function createJobApplicationRouter(dependencies: {
  submitJobApplication: SubmitJobApplicationUseCase;
  deleteJobApplication: DeleteJobApplicationUseCase;
  generateJobApplicationDocuments: GenerateJobApplicationDocumentsUseCase;
  retryJobApplication: RetryJobApplicationUseCase;
  updateDocumentContent: UpdateDocumentContentUseCase;
  jobApplications: JobApplicationRepository;
  jobApplicationChanges: JobApplicationChangeSubscriber;
  queue: JobApplicationQueue;
  storage: FileStorage;
  getProfileForUser: (user: AuthenticatedRequest["user"]) => Promise<UserProfile>;
  canAccessProfile: (profileId: string, userId: string) => Promise<boolean>;
  canAccessJobApplication: (jobApplicationId: string, userId: string) => Promise<boolean>;
  generateWithAi?: GenerateDocumentsWithAiUseCase;
}): ExpressRouter {
  const router = Router();

  router.param("id", async (request, response, next, id: string) => {
    try {
      if (!(await dependencies.canAccessJobApplication(id, currentUser(request).id))) {
        response.status(404).json({ error: "Job application not found" });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  });

  router.put(
    "/:id/status",
    validateBody(updateStatusSchema),
    async (request, response, next) => {
      try {
        const jobApplication = await dependencies.jobApplications.findById(request.params.id);

        if (!jobApplication) {
          response.status(404).json({ error: "Job application not found" });
          return;
        }

        const { status } = request.body;

        if (!canTransitionJobApplicationStatus(jobApplication.status, status)) {
          response.status(400).json({ error: "Invalid status transition" });
          return;
        }

        await dependencies.jobApplications.updateStatus(request.params.id, status);

        await dependencies.jobApplications.addEvent({
          jobApplicationId: request.params.id,
          type: "processing",
          title: "Scraping started",
        });

        const updated = await dependencies.jobApplications.findById(request.params.id);

        if (!updated) {
          response.status(404).json({ error: "Job application not found" });
          return;
        }

        response.json(updated);
      } catch (error) {
        next(error);
      }
    },
  );

  router.put(
    "/:id/scrape-data",
    validateBody(submitScrapeDataSchema),
    async (request, response, next) => {
      try {
        const jobApplication = await dependencies.jobApplications.findById(request.params.id);

        if (!jobApplication) {
          response.status(404).json({ error: "Job application not found" });
          return;
        }

        if (!canTransitionJobApplicationStatus(jobApplication.status, "scraped")) {
          response.status(400).json({ error: "Invalid status transition" });
          return;
        }

        const scrape = request.body.scrapeBundle as ScrapeBundle;
        await dependencies.jobApplications.saveScrapeBundle(request.params.id, scrape);

        await dependencies.jobApplications.updateTracking(request.params.id, {
          companyName: scrape.job.companyName,
          roleTitle: scrape.job.title,
        });

        await dependencies.jobApplications.updateStatus(request.params.id, "scraped");

        await dependencies.jobApplications.addEvent({
          jobApplicationId: request.params.id,
          type: "processing",
          title: "Scraping complete",
          metadata: {
            companyName: scrape.job.companyName,
            roleTitle: scrape.job.title,
          },
        });

        await dependencies.queue.enqueue({ jobApplicationId: request.params.id });

        const updated = await dependencies.jobApplications.findById(request.params.id);

        if (!updated) {
          response.status(404).json({ error: "Job application not found" });
          return;
        }

        response.json(
          await getJobApplicationDetail({
            jobApplications: dependencies.jobApplications,
            storage: dependencies.storage,
            jobApplication: updated,
          }),
        );
      } catch (error) {
        next(error);
      }
    },
  );

  router.get("/stream", async (request, response, next) => {
    const profileId =
      typeof request.query.profileId === "string" ? request.query.profileId.trim() : "";

    if (!profileId) {
      response.status(400).json({ error: "profileId is required" });
      return;
    }

    try {
      if (!(await dependencies.canAccessProfile(profileId, currentUser(request).id))) {
        response.status(404).json({ error: "Profile not found" });
        return;
      }

      response.status(200);
      response.set({
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream",
        "X-Accel-Buffering": "no",
      });
      response.flushHeaders();
      response.write(": connected\n\n");

      const unsubscribe = await dependencies.jobApplicationChanges.subscribe(
        profileId,
        (change) => {
          response.write(`event: ${change.type}\n`);
          response.write(`data: ${JSON.stringify(change)}\n\n`);
        },
      );
      const heartbeat = setInterval(() => {
        response.write(": heartbeat\n\n");
      }, 20_000);

      request.on("close", () => {
        clearInterval(heartbeat);
        unsubscribe();
        response.end();
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/", validateBody(createJobApplicationSchema), async (request, response, next) => {
    try {
      if (!(await dependencies.canAccessProfile(request.body.profileId, currentUser(request).id))) {
        response.status(404).json({ error: "Profile not found" });
        return;
      }

      const jobApplication = await dependencies.submitJobApplication.execute(request.body);
      response.status(201).json(jobApplication);
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/from-scrape",
    validateBody(createJobApplicationFromScrapeSchema),
    async (request, response, next) => {
      try {
        const profile = await dependencies.getProfileForUser(currentUser(request));
        const scrape = request.body.scrapeBundle as ScrapeBundle;
        const jobApplication = await dependencies.jobApplications.create({
          profileId: profile.id,
          shouldProcess: true,
          sourceUrl: request.body.sourceUrl,
          companyName: scrape.job.companyName,
          roleTitle: scrape.job.title,
          roleType: scrape.job.location,
          jobUrl: request.body.sourceUrl,
          dateApplied: request.body.dateApplied,
          applicationStatus: request.body.applicationStatus,
          priority: request.body.priority,
          tags: request.body.tags,
          metadata: request.body.metadata,
        });

        await dependencies.jobApplications.saveScrapeBundle(jobApplication.id, scrape);
        await dependencies.jobApplications.addEvent({
          jobApplicationId: jobApplication.id,
          type: "processing",
          title: "Desktop scrape received",
          metadata: {
            companyName: scrape.job.companyName,
            roleTitle: scrape.job.title,
          },
        });
        await dependencies.queue.enqueue({ jobApplicationId: jobApplication.id });

        response.status(201).json(jobApplication);
      } catch (error) {
        next(error);
      }
    },
  );

  router.get("/", async (request, response, next) => {
    try {
      const result = listJobApplicationsQuerySchema.safeParse(request.query);

      if (!result.success) {
        response
          .status(400)
          .json({ error: "Invalid query parameters", issues: result.error.issues });
        return;
      }

      if (!(await dependencies.canAccessProfile(result.data.profileId, currentUser(request).id))) {
        response.status(404).json({ error: "Profile not found" });
        return;
      }

      const jobApplicationsWithDocuments = await listJobApplicationsWithDocuments(
        dependencies.jobApplications,
        dependencies.storage,
        result.data.profileId,
        result.data,
      );

      response.json(jobApplicationsWithDocuments);
    } catch (error) {
      next(error);
    }
  });

  router.get("/analytics", async (request, response, next) => {
    try {
      const result = jobApplicationAnalyticsQuerySchema.safeParse(request.query);

      if (!result.success) {
        response
          .status(400)
          .json({ error: "Invalid query parameters", issues: result.error.issues });
        return;
      }

      if (!(await dependencies.canAccessProfile(result.data.profileId, currentUser(request).id))) {
        response.status(404).json({ error: "Profile not found" });
        return;
      }

      const jobs = await dependencies.jobApplications.listByProfileId(result.data.profileId);
      response.json(calculateJobApplicationAnalytics(jobs));
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id", async (request, response, next) => {
    try {
      const jobApplication = await dependencies.jobApplications.findById(request.params.id);

      if (!jobApplication) {
        response.status(404).json({ error: "Job application not found" });
        return;
      }

      response.json(
        await getJobApplicationDetail({
          jobApplications: dependencies.jobApplications,
          storage: dependencies.storage,
          jobApplication,
        }),
      );
    } catch (error) {
      next(error);
    }
  });

  router.patch(
    "/:id",
    validateBody(updateJobApplicationSchema),
    async (request, response, next) => {
      try {
        const existing = await dependencies.jobApplications.findById(request.params.id);

        if (!existing) {
          response.status(404).json({ error: "Job application not found" });
          return;
        }

        const previousStatus = existing.tracking.applicationStatus;
        const updated = await dependencies.jobApplications.updateTracking(
          request.params.id,
          request.body,
        );

        if (request.body.applicationStatus && request.body.applicationStatus !== previousStatus) {
          await dependencies.jobApplications.addEvent({
            jobApplicationId: request.params.id,
            type: "status_changed",
            title: `Status changed to ${request.body.applicationStatus}`,
            metadata: { from: previousStatus, to: request.body.applicationStatus },
          });
        }

        response.json(updated);
      } catch (error) {
        next(error);
      }
    },
  );

  router.delete("/:id", async (request, response, next) => {
    try {
      const deleted = await dependencies.deleteJobApplication.execute(request.params.id);

      if (!deleted) {
        response.status(404).json({ error: "Job application not found" });
        return;
      }

      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.post("/:id/retry", async (request, response, next) => {
    try {
      const retried = await dependencies.retryJobApplication.execute(request.params.id);

      if (!retried) {
        response.status(404).json({ error: "Job application not found" });
        return;
      }

      response.status(202).json(retried);
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/:id/events",
    validateBody(createJobApplicationEventSchema),
    async (request, response, next) => {
      try {
        const jobApplication = await dependencies.jobApplications.findById(request.params.id);

        if (!jobApplication) {
          response.status(404).json({ error: "Job application not found" });
          return;
        }

        const event = await dependencies.jobApplications.addEvent({
          jobApplicationId: request.params.id,
          ...request.body,
        });

        response.status(201).json(event);
      } catch (error) {
        next(error);
      }
    },
  );

  router.get("/:id/events", async (request, response, next) => {
    try {
      const jobApplication = await dependencies.jobApplications.findById(request.params.id);

      if (!jobApplication) {
        response.status(404).json({ error: "Job application not found" });
        return;
      }

      response.json(await dependencies.jobApplications.listEvents(request.params.id));
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/:id/contacts",
    validateBody(createJobApplicationContactSchema),
    async (request, response, next) => {
      try {
        const jobApplication = await dependencies.jobApplications.findById(request.params.id);

        if (!jobApplication) {
          response.status(404).json({ error: "Job application not found" });
          return;
        }

        const contact = await dependencies.jobApplications.createContact({
          jobApplicationId: request.params.id,
          ...request.body,
        });

        response.status(201).json(contact);
      } catch (error) {
        next(error);
      }
    },
  );

  router.get("/:id/contacts", async (request, response, next) => {
    try {
      const jobApplication = await dependencies.jobApplications.findById(request.params.id);

      if (!jobApplication) {
        response.status(404).json({ error: "Job application not found" });
        return;
      }

      response.json(await dependencies.jobApplications.listContacts(request.params.id));
    } catch (error) {
      next(error);
    }
  });

  router.patch(
    "/:id/contacts/:contactId",
    validateBody(updateJobApplicationContactSchema),
    async (request, response, next) => {
      try {
        const contact = await dependencies.jobApplications.findContactById(
          request.params.contactId,
        );

        if (!contact || contact.jobApplicationId !== request.params.id) {
          response.status(404).json({ error: "Contact not found" });
          return;
        }

        response.json(
          await dependencies.jobApplications.updateContact(request.params.contactId, request.body),
        );
      } catch (error) {
        next(error);
      }
    },
  );

  router.delete("/:id/contacts/:contactId", async (request, response, next) => {
    try {
      const contact = await dependencies.jobApplications.findContactById(request.params.contactId);

      if (!contact || contact.jobApplicationId !== request.params.id) {
        response.status(404).json({ error: "Contact not found" });
        return;
      }

      await dependencies.jobApplications.deleteContact(request.params.contactId);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/:id/interviews",
    validateBody(createJobApplicationInterviewSchema),
    async (request, response, next) => {
      try {
        const jobApplication = await dependencies.jobApplications.findById(request.params.id);

        if (!jobApplication) {
          response.status(404).json({ error: "Job application not found" });
          return;
        }

        const interview = await dependencies.jobApplications.createInterview({
          jobApplicationId: request.params.id,
          ...request.body,
        });

        await recordInterviewCreated(dependencies.jobApplications, jobApplication, interview);
        response.status(201).json(interview);
      } catch (error) {
        next(error);
      }
    },
  );

  router.get("/:id/interviews", async (request, response, next) => {
    try {
      const jobApplication = await dependencies.jobApplications.findById(request.params.id);

      if (!jobApplication) {
        response.status(404).json({ error: "Job application not found" });
        return;
      }

      response.json(await dependencies.jobApplications.listInterviews(request.params.id));
    } catch (error) {
      next(error);
    }
  });

  router.patch(
    "/:id/interviews/:interviewId",
    validateBody(updateJobApplicationInterviewSchema),
    async (request, response, next) => {
      try {
        const interview = await dependencies.jobApplications.findInterviewById(
          request.params.interviewId,
        );

        if (!interview || interview.jobApplicationId !== request.params.id) {
          response.status(404).json({ error: "Interview not found" });
          return;
        }

        const updated = await dependencies.jobApplications.updateInterview(
          request.params.interviewId,
          request.body,
        );

        await recordInterviewUpdated(dependencies.jobApplications, interview, updated);
        response.json(updated);
      } catch (error) {
        next(error);
      }
    },
  );

  router.delete("/:id/interviews/:interviewId", async (request, response, next) => {
    try {
      const interview = await dependencies.jobApplications.findInterviewById(
        request.params.interviewId,
      );

      if (!interview || interview.jobApplicationId !== request.params.id) {
        response.status(404).json({ error: "Interview not found" });
        return;
      }

      await dependencies.jobApplications.deleteInterview(request.params.interviewId);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.put(
    "/:id/document-content",
    validateBody(updateDocumentContentSchema),
    async (request, response, next) => {
      try {
        const documentContent = await dependencies.updateDocumentContent.execute(
          request.params.id,
          request.body.documentContent,
        );

        if (!documentContent) {
          response.status(404).json({ error: "Job application not found" });
          return;
        }

        response.json({ documentContent });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post("/:id/documents/generate", async (request, response, next) => {
    try {
      const jobApplication = await dependencies.jobApplications.findById(request.params.id);

      if (!jobApplication) {
        response.status(404).json({ error: "Job application not found" });
        return;
      }

      await dependencies.generateJobApplicationDocuments.execute(request.params.id);

      const updated = await dependencies.jobApplications.findById(request.params.id);

      if (!updated) {
        response.status(404).json({ error: "Job application not found" });
        return;
      }

      response.status(201).json(
        await getJobApplicationDetail({
          jobApplications: dependencies.jobApplications,
          storage: dependencies.storage,
          jobApplication: updated,
        }),
      );
    } catch (error) {
      next(error);
    }
  });

  if (dependencies.generateWithAi) {
    router.post("/:id/documents/generate-with-ai", async (request, response, next) => {
      try {
        const jobApplication = await dependencies.jobApplications.findById(request.params.id);

        if (!jobApplication) {
          response.status(404).json({ error: "Job application not found" });
          return;
        }

        const preferences = request.body ?? {};

        await dependencies.generateWithAi!.execute({
          jobApplicationId: request.params.id,
          preferences: {
            templateId: preferences.templateId ?? "cv.default",
            documentType: preferences.documentType ?? "both",
            language: preferences.language ?? "en",
            tone: preferences.tone ?? "professional",
          },
        });

        const updated = await dependencies.jobApplications.findById(request.params.id);

        if (!updated) {
          response.status(404).json({ error: "Job application not found" });
          return;
        }

        response.status(201).json(
          await getJobApplicationDetail({
            jobApplications: dependencies.jobApplications,
            storage: dependencies.storage,
            jobApplication: updated,
          }),
        );
      } catch (error) {
        next(error);
      }
    });
  }

  router.get("/:id/documents/:documentId/download", async (request, response, next) => {
    try {
      const url = await getGeneratedDocumentDownloadUrl({
        jobApplications: dependencies.jobApplications,
        storage: dependencies.storage,
        jobApplicationId: request.params.id,
        documentId: request.params.documentId,
      });

      if (!url) {
        response.status(404).json({ error: "Document not found" });
        return;
      }

      response.json({ url });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export async function getJobApplicationDetail(input: {
  jobApplications: JobApplicationRepository;
  storage: FileStorage;
  jobApplication: JobApplication;
}): Promise<JobApplicationDetail> {
  const documents = await input.jobApplications.listGeneratedDocuments(input.jobApplication.id);
  const events = await input.jobApplications.listEvents(input.jobApplication.id);
  const contacts = await input.jobApplications.listContacts(input.jobApplication.id);
  const interviews = await input.jobApplications.listInterviews(input.jobApplication.id);
  const scrapeBundle = await input.jobApplications.getScrapeBundle(input.jobApplication.id);
  const matchAnalysis = await input.jobApplications.getMatchAnalysis(input.jobApplication.id);
  const documentContent = await input.jobApplications.getDocumentContent(input.jobApplication.id);
  const companyLogoUrl = await getCompanyLogoUrl(
    input.jobApplications,
    input.storage,
    input.jobApplication.id,
  );

  return {
    ...input.jobApplication,
    documents,
    events,
    contacts,
    interviews,
    scrapeBundle: toPublicScrapeBundle(scrapeBundle),
    matchAnalysis,
    documentContent,
    ...(companyLogoUrl ? { companyLogoUrl } : {}),
  };
}

export async function listJobApplicationsWithDocuments(
  jobApplications: JobApplicationRepository,
  storage: FileStorage,
  profileId: string,
  filter: Parameters<JobApplicationRepository["listByProfileId"]>[1] = {},
): Promise<JobApplicationWithDocuments[]> {
  const jobs = await jobApplications.listByProfileId(profileId, filter);

  return Promise.all(
    jobs.map(async (jobApplication) => {
      const [documents, companyLogoUrl, matchAnalysis] = await Promise.all([
        jobApplications.listGeneratedDocuments(jobApplication.id),
        getCompanyLogoUrl(jobApplications, storage, jobApplication.id),
        jobApplications.getMatchAnalysis(jobApplication.id),
      ]);

      return {
        ...jobApplication,
        documents,
        ...(companyLogoUrl ? { companyLogoUrl } : {}),
        ...(matchAnalysis ? { matchScore: matchAnalysis.matchScore } : {}),
      };
    }),
  );
}

function toPublicScrapeBundle(scrape: ScrapeBundle | null): ScrapeBundle | null {
  if (!scrape) {
    return null;
  }

  return {
    ...scrape,
    companyLinkedIn: withoutInternalLogoFields(scrape.companyLinkedIn),
    companyWebsite: withoutInternalLogoFields(scrape.companyWebsite),
    careerPage: withoutInternalLogoFields(scrape.careerPage),
  };
}

function withoutInternalLogoFields(
  company: ScrapeBundle["companyLinkedIn"],
): ScrapeBundle["companyLinkedIn"] {
  if (!company) {
    return undefined;
  }

  const publicCompany = { ...company };
  delete publicCompany.logoFileId;
  delete publicCompany.logoUrl;
  return publicCompany;
}

async function getCompanyLogoUrl(
  jobApplications: JobApplicationRepository,
  storage: FileStorage,
  jobApplicationId: string,
): Promise<string | undefined> {
  try {
    const fileId = await jobApplications.getCompanyLogoFileId(jobApplicationId);
    return fileId ? await storage.getSignedUrl(fileId) : undefined;
  } catch {
    return undefined;
  }
}

export function calculateJobApplicationAnalytics(jobs: JobApplication[]) {
  const total = jobs.length;
  const byStatus = jobs.reduce<Record<string, number>>((current, job) => {
    current[job.tracking.applicationStatus] = (current[job.tracking.applicationStatus] ?? 0) + 1;
    return current;
  }, {});
  const interviews = jobs.filter((job) =>
    ["phone_screen", "interview", "offer"].includes(job.tracking.applicationStatus),
  ).length;
  const offers = byStatus.offer ?? 0;
  const rejections = byStatus.rejected ?? 0;
  const responses = interviews + rejections;
  const responseRate = total === 0 ? 0 : responses / total;
  const interviewConversionRate = total === 0 ? 0 : interviews / total;
  const applicationsOverTime = jobs.reduce<Record<string, number>>((current, job) => {
    const key = job.tracking.dateApplied ?? job.createdAt.toISOString().slice(0, 10);
    current[key] = (current[key] ?? 0) + 1;
    return current;
  }, {});
  const responseDurations = jobs
    .filter((job) => job.tracking.lastResponseAt)
    .map((job) => {
      const start = new Date(job.tracking.dateApplied ?? job.createdAt).getTime();
      const end = job.tracking.lastResponseAt?.getTime() ?? start;
      return Math.max(0, Math.round((end - start) / 86_400_000));
    });
  const averageTimeToResponseDays =
    responseDurations.length === 0
      ? null
      : responseDurations.reduce((sum, days) => sum + days, 0) / responseDurations.length;

  return {
    total,
    byStatus,
    responseRate,
    interviewConversionRate,
    offers,
    rejections,
    applicationsOverTime,
    averageTimeToResponseDays,
  };
}

export async function getGeneratedDocumentDownloadUrl(input: {
  jobApplications: JobApplicationRepository;
  storage: FileStorage;
  jobApplicationId: string;
  documentId: string;
}): Promise<string | undefined> {
  const documents = await input.jobApplications.listGeneratedDocuments(input.jobApplicationId);
  const document = documents.find((item) => item.id === input.documentId);

  if (!document) {
    return undefined;
  }

  return input.storage.getSignedUrl(document.fileId);
}

async function recordInterviewCreated(
  jobApplications: JobApplicationRepository,
  jobApplication: JobApplication,
  interview: JobApplicationInterview,
): Promise<void> {
  await jobApplications.addEvent({
    jobApplicationId: interview.jobApplicationId,
    type: "interview",
    title: `Interview scheduled: ${interview.title}`,
    occurredAt: interview.scheduledAt,
    metadata: { interviewId: interview.id, status: interview.status, type: interview.type },
  });

  if (interview.status === "upcoming" && !jobApplication.tracking.nextFollowUpAt) {
    await jobApplications.updateTracking(interview.jobApplicationId, {
      nextFollowUpAt: interview.scheduledAt,
    });
  }

  if (interview.status === "completed" && !jobApplication.tracking.lastResponseAt) {
    await jobApplications.updateTracking(interview.jobApplicationId, {
      lastResponseAt: interview.scheduledAt,
    });
  }
}

async function recordInterviewUpdated(
  jobApplications: JobApplicationRepository,
  previous: JobApplicationInterview,
  updated: JobApplicationInterview,
): Promise<void> {
  if (updated.scheduledAt.getTime() !== previous.scheduledAt.getTime()) {
    await jobApplications.addEvent({
      jobApplicationId: updated.jobApplicationId,
      type: "interview",
      title: `Interview rescheduled: ${updated.title}`,
      occurredAt: updated.scheduledAt,
      metadata: { interviewId: updated.id, from: previous.scheduledAt, to: updated.scheduledAt },
    });
  }

  if (updated.status !== previous.status) {
    await jobApplications.addEvent({
      jobApplicationId: updated.jobApplicationId,
      type: "interview",
      title: `Interview marked ${updated.status}: ${updated.title}`,
      occurredAt: updated.scheduledAt,
      metadata: { interviewId: updated.id, from: previous.status, to: updated.status },
    });
  }

  if (updated.status !== "completed") {
    return;
  }

  const jobApplication = await jobApplications.findById(updated.jobApplicationId);

  if (jobApplication && !jobApplication.tracking.lastResponseAt) {
    await jobApplications.updateTracking(updated.jobApplicationId, {
      lastResponseAt: updated.scheduledAt,
    });
  }
}

function currentUser(request: Request): AuthenticatedRequest["user"] {
  return (request as AuthenticatedRequest).user;
}
