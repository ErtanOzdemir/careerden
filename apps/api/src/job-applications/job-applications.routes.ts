import { Router } from "express";
import type { Request, Router as ExpressRouter } from "express";
import type {
  DeleteJobApplicationUseCase,
  GenerateDocumentsWithAiUseCase,
  GenerateJobApplicationDocumentsUseCase,
  RetryJobApplicationUseCase,
  RetryJobApplicationOptions,
  SubmitJobApplicationUseCase,
  UpdateDocumentContentUseCase,
} from "@link2cv/application";
import type {
  FileStorage,
  FollowUpReminderQueue,
  FollowUpReminderRepository,
  DocumentContent,
  GeneratedDocument,
  JobApplication,
  JobApplicationContact,
  JobApplicationEvent,
  JobApplicationFollowUp,
  JobApplicationChangeSubscriber,
  JobApplicationQueue,
  JobApplicationRepository,
  MatchAnalysisResult,
  RemoteImageFetcher,
  ScrapeBundle,
  UserProfile,
  UserProfileRepository,
} from "@link2cv/domain";
import { canTransitionJobApplicationStatus } from "@link2cv/domain";
import { getFollowUpReminderScheduledFor } from "@link2cv/infrastructure";
import {
  createJobApplicationFromScrapeSchema,
  claimScrapeJobSchema,
  createJobApplicationContactSchema,
  createJobApplicationEventSchema,
  createJobApplicationFollowUpSchema,
  failScrapeJobSchema,
  heartbeatScrapeJobSchema,
  createJobApplicationSchema,
  jobApplicationAnalyticsQuerySchema,
  listJobApplicationsQuerySchema,
  submitScrapeDataSchema,
  updateJobApplicationContactSchema,
  updateJobApplicationFollowUpSchema,
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
  followUps: JobApplicationFollowUp[];
  scrapeBundle: ScrapeBundle | null;
  matchAnalysis: MatchAnalysisResult | null;
  documentContent: DocumentContent | null;
};

const scrapeClaimDurationMs = 600_000;
const maxScrapeAttempts = 3;
const scrapeRetryBackoffMs = [60_000, 300_000];

export function createJobApplicationRouter(dependencies: {
  submitJobApplication: SubmitJobApplicationUseCase;
  deleteJobApplication: DeleteJobApplicationUseCase;
  generateJobApplicationDocuments: GenerateJobApplicationDocumentsUseCase;
  retryJobApplication: RetryJobApplicationUseCase;
  updateDocumentContent: UpdateDocumentContentUseCase;
  jobApplications: JobApplicationRepository;
  profiles: UserProfileRepository;
  jobApplicationChanges: JobApplicationChangeSubscriber;
  queue: JobApplicationQueue;
  followUpReminderQueue: FollowUpReminderQueue;
  followUpReminders: FollowUpReminderRepository;
  storage: FileStorage;
  remoteImages: RemoteImageFetcher;
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

  router.put("/:id/status", validateBody(updateStatusSchema), async (request, response, next) => {
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
  });

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

        if (
          jobApplication.scrapeClaimedBy &&
          jobApplication.scrapeClaimedBy !== request.body.claimedBy
        ) {
          response.status(409).json({ error: "Scrape claim is owned by another desktop client" });
          return;
        }

        const scrape = request.body.scrapeBundle as ScrapeBundle;
        await dependencies.jobApplications.saveScrapeBundle(request.params.id, scrape);

        await storeCompanyLogo(
          request.params.id,
          scrape,
          dependencies.remoteImages,
          dependencies.storage,
          dependencies.jobApplications,
        );

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

        const profile = await dependencies.profiles.findById(jobApplication.profileId);

        if (!profile) {
          response.status(404).json({ error: "Profile not found" });
          return;
        }

        await enqueueMatchAnalysisIfEnabled({
          jobApplications: dependencies.jobApplications,
          queue: dependencies.queue,
          jobApplicationId: request.params.id,
          autoRunMatchAnalysis: profile.autoRunMatchAnalysis,
        });

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
    "/scraping/claim",
    validateBody(claimScrapeJobSchema),
    async (request, response, next) => {
      try {
        const profile = await dependencies.getProfileForUser(currentUser(request));
        const claimed = await claimNextScrapeJob(dependencies.jobApplications, {
          profileId: profile.id,
          claimedBy: request.body.claimedBy,
        });

        if (!claimed) {
          response.status(204).send();
          return;
        }

        response.json(claimed);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/from-scrape",
    validateBody(createJobApplicationFromScrapeSchema),
    async (request, response, next) => {
      try {
        const profile = await dependencies.getProfileForUser(currentUser(request));
        const scrape = request.body.scrapeBundle as ScrapeBundle;
        const jobApplication = await dependencies.jobApplications.create({
          profileId: profile.id,
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
        await dependencies.jobApplications.updateStatus(jobApplication.id, "scraped");
        await dependencies.jobApplications.addEvent({
          jobApplicationId: jobApplication.id,
          type: "processing",
          title: "Desktop scrape received",
          metadata: {
            companyName: scrape.job.companyName,
            roleTitle: scrape.job.title,
          },
        });
        await enqueueMatchAnalysisIfEnabled({
          jobApplications: dependencies.jobApplications,
          queue: dependencies.queue,
          jobApplicationId: jobApplication.id,
          autoRunMatchAnalysis: profile.autoRunMatchAnalysis,
        });

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
      const retried = await retryFailedJobApplication({
        retryJobApplication: dependencies.retryJobApplication,
        queue: dependencies.queue,
        jobApplicationId: request.params.id,
      });

      if (!retried) {
        response.status(404).json({ error: "Job application not found" });
        return;
      }

      response.status(202).json(retried);
    } catch (error) {
      next(error);
    }
  });

  router.post("/:id/analysis", async (request, response) => {
    try {
      const requested = await requestJobApplicationAnalysis({
        jobApplications: dependencies.jobApplications,
        queue: dependencies.queue,
        jobApplicationId: request.params.id,
      });

      if (!requested) {
        response.status(404).json({ error: "Job application not found" });
        return;
      }

      response.status(202).json(requested);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start analysis";
      response.status(400).json({ error: message });
    }
  });

  router.post("/:id/scraping/retry", async (request, response, next) => {
    try {
      const retried = await retryFailedJobApplication({
        retryJobApplication: dependencies.retryJobApplication,
        queue: dependencies.queue,
        jobApplicationId: request.params.id,
        retryOptions: { mode: "scraping" },
      });

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
    "/:id/scraping/heartbeat",
    validateBody(heartbeatScrapeJobSchema),
    async (request, response, next) => {
      try {
        const renewed = await renewScrapeClaim(
          dependencies.jobApplications,
          request.params.id,
          request.body,
        );

        if (!renewed) {
          response.status(404).json({ error: "Job application not found" });
          return;
        }

        response.status(202).json(renewed);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/:id/scraping/fail",
    validateBody(failScrapeJobSchema),
    async (request, response, next) => {
      try {
        const failed = await failScrapeJob(
          dependencies.jobApplications,
          request.params.id,
          request.body,
        );

        if (!failed) {
          response.status(404).json({ error: "Job application not found" });
          return;
        }

        response.status(202).json({ status: failed });
      } catch (error) {
        next(error);
      }
    },
  );

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
    "/:id/follow-ups",
    validateBody(createJobApplicationFollowUpSchema),
    async (request, response, next) => {
      try {
        const jobApplication = await dependencies.jobApplications.findById(request.params.id);

        if (!jobApplication) {
          response.status(404).json({ error: "Job application not found" });
          return;
        }

        const followUp = await dependencies.jobApplications.createFollowUp({
          jobApplicationId: request.params.id,
          profileId: jobApplication.profileId,
          title: request.body.title,
          description: request.body.description,
          scheduledAt: request.body.scheduledAt,
        });

        await scheduleFollowUpReminder({
          followUp,
          followUpReminderQueue: dependencies.followUpReminderQueue,
          followUpReminders: dependencies.followUpReminders,
        });

        await dependencies.jobApplications.addEvent({
          jobApplicationId: request.params.id,
          type: "reminder",
          title: `Follow-up scheduled: ${followUp.title}`,
          occurredAt: followUp.scheduledAt,
        });

        response.status(201).json(followUp);
      } catch (error) {
        next(error);
      }
    },
  );

  router.get("/:id/follow-ups", async (request, response, next) => {
    try {
      const jobApplication = await dependencies.jobApplications.findById(request.params.id);

      if (!jobApplication) {
        response.status(404).json({ error: "Job application not found" });
        return;
      }

      response.json(await dependencies.jobApplications.listFollowUps(request.params.id));
    } catch (error) {
      next(error);
    }
  });

  router.patch(
    "/:id/follow-ups/:followUpId",
    validateBody(updateJobApplicationFollowUpSchema),
    async (request, response, next) => {
      try {
        const existing = await dependencies.jobApplications.findFollowUpById(
          request.params.followUpId,
        );

        if (!existing || existing.jobApplicationId !== request.params.id) {
          response.status(404).json({ error: "Follow-up not found" });
          return;
        }

        const updated = await dependencies.jobApplications.updateFollowUp(
          request.params.followUpId,
          request.body,
        );

        if ("scheduledAt" in request.body && existing.reminderJobId) {
          await dependencies.followUpReminderQueue.remove(existing.reminderJobId);
        }

        if ("scheduledAt" in request.body) {
          await scheduleFollowUpReminder({
            followUp: updated,
            followUpReminderQueue: dependencies.followUpReminderQueue,
            followUpReminders: dependencies.followUpReminders,
          });

          await dependencies.jobApplications.addEvent({
            jobApplicationId: request.params.id,
            type: "reminder",
            title: `Follow-up rescheduled: ${updated.title}`,
            occurredAt: updated.scheduledAt,
          });
        }

        response.json(updated);
      } catch (error) {
        next(error);
      }
    },
  );

  router.delete("/:id/follow-ups/:followUpId", async (request, response, next) => {
    try {
      const followUp = await dependencies.jobApplications.findFollowUpById(
        request.params.followUpId,
      );

      if (!followUp || followUp.jobApplicationId !== request.params.id) {
        response.status(404).json({ error: "Follow-up not found" });
        return;
      }

      if (followUp.reminderJobId) {
        await dependencies.followUpReminderQueue.remove(followUp.reminderJobId);
      }

      await dependencies.jobApplications.deleteFollowUp(request.params.followUpId);
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

async function scheduleFollowUpReminder(input: {
  followUp: JobApplicationFollowUp;
  followUpReminderQueue: FollowUpReminderQueue;
  followUpReminders: FollowUpReminderRepository;
}): Promise<void> {
  const scheduledFor = getFollowUpReminderScheduledFor(input.followUp.scheduledAt);
  const scheduled = await input.followUpReminderQueue.enqueue({
    followUpId: input.followUp.id,
    jobApplicationId: input.followUp.jobApplicationId,
    profileId: input.followUp.profileId,
    followUpAt: input.followUp.scheduledAt,
    scheduledFor,
  });

  await input.followUpReminders.setSchedule(input.followUp.id, {
    jobId: scheduled.jobId,
    scheduledFor,
  });
}

export async function retryFailedJobApplication(input: {
  retryJobApplication: Pick<RetryJobApplicationUseCase, "execute">;
  queue: JobApplicationQueue;
  jobApplicationId: string;
  retryOptions?: RetryJobApplicationOptions;
}): Promise<JobApplication | null> {
  const retried = await input.retryJobApplication.execute(
    input.jobApplicationId,
    input.retryOptions,
  );

  if (!retried) {
    return null;
  }

  if (retried.mode === "analysis") {
    await input.queue.restart({ jobApplicationId: input.jobApplicationId });
  }

  return retried.jobApplication;
}

export async function enqueueMatchAnalysisIfEnabled(input: {
  jobApplications: Pick<JobApplicationRepository, "addEvent">;
  queue: JobApplicationQueue;
  jobApplicationId: string;
  autoRunMatchAnalysis: boolean;
}): Promise<boolean> {
  if (input.autoRunMatchAnalysis) {
    await input.queue.enqueue({ jobApplicationId: input.jobApplicationId });
    return true;
  }

  await input.jobApplications.addEvent({
    jobApplicationId: input.jobApplicationId,
    type: "processing",
    title: "AI analysis skipped",
    body: "Auto-run match analysis is disabled for this profile.",
  });
  return false;
}

export async function requestJobApplicationAnalysis(input: {
  jobApplications: Pick<JobApplicationRepository, "addEvent" | "findById" | "getScrapeBundle">;
  queue: JobApplicationQueue;
  jobApplicationId: string;
}): Promise<JobApplication | null> {
  const jobApplication = await input.jobApplications.findById(input.jobApplicationId);

  if (!jobApplication) {
    return null;
  }

  if (jobApplication.status !== "scraped") {
    throw new Error("AI analysis can only be started after scraping completes");
  }

  const scrape = await input.jobApplications.getScrapeBundle(input.jobApplicationId);

  if (!scrape) {
    throw new Error("AI analysis requires saved scrape data");
  }

  await input.jobApplications.addEvent({
    jobApplicationId: input.jobApplicationId,
    type: "processing",
    title: "AI analysis requested",
  });
  await input.queue.enqueue({ jobApplicationId: input.jobApplicationId });

  return jobApplication;
}

export async function getJobApplicationDetail(input: {
  jobApplications: JobApplicationRepository;
  storage: FileStorage;
  jobApplication: JobApplication;
}): Promise<JobApplicationDetail> {
  const documents = await input.jobApplications.listGeneratedDocuments(input.jobApplication.id);
  const events = await input.jobApplications.listEvents(input.jobApplication.id);
  const contacts = await input.jobApplications.listContacts(input.jobApplication.id);
  const followUps = await input.jobApplications.listFollowUps(input.jobApplication.id);
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
    followUps,
    scrapeBundle: toPublicScrapeBundle(scrapeBundle),
    matchAnalysis,
    documentContent,
    ...(companyLogoUrl ? { companyLogoUrl } : {}),
  };
}

export function claimNextScrapeJob(
  jobApplications: JobApplicationRepository,
  input: { claimedBy: string; profileId: string },
): Promise<JobApplication | null> {
  return claimNextScrapeJobWithEvent(jobApplications, input);
}

async function claimNextScrapeJobWithEvent(
  jobApplications: JobApplicationRepository,
  input: { claimedBy: string; profileId: string },
): Promise<JobApplication | null> {
  const claimed = await jobApplications.claimNextScrapeJob({
    profileId: input.profileId,
    claimedBy: input.claimedBy,
    claimDurationMs: scrapeClaimDurationMs,
  });

  if (claimed) {
    await jobApplications.addEvent({
      jobApplicationId: claimed.id,
      type: "processing",
      title: "Scraping started",
    });
  }

  return claimed;
}

export function renewScrapeClaim(
  jobApplications: JobApplicationRepository,
  jobApplicationId: string,
  input: { claimedBy: string },
): Promise<JobApplication | null> {
  return jobApplications.renewScrapeClaim(jobApplicationId, {
    claimedBy: input.claimedBy,
    claimDurationMs: scrapeClaimDurationMs,
  });
}

export async function failScrapeJob(
  jobApplications: JobApplicationRepository,
  jobApplicationId: string,
  input: { claimedBy: string; reason: string },
  now = new Date(),
): Promise<"failed" | "retry_scheduled" | false> {
  const jobApplication = await jobApplications.findById(jobApplicationId);

  if (!jobApplication) {
    return false;
  }

  if (jobApplication.scrapeClaimedBy && jobApplication.scrapeClaimedBy !== input.claimedBy) {
    throw new Error("Job application scrape claim is owned by another desktop client");
  }

  const backoffMs = scrapeRetryBackoffMs[jobApplication.scrapeAttemptCount - 1] ?? 0;
  const updated = await jobApplications.recordScrapeFailure(jobApplicationId, {
    claimedBy: input.claimedBy,
    reason: input.reason,
    maxAttempts: maxScrapeAttempts,
    backoffMs,
    now,
  });

  if (!updated) {
    return false;
  }

  if (updated.status === "failed") {
    await jobApplications.addEvent({
      jobApplicationId,
      type: "processing",
      title: "Scraping failed",
      body: input.reason,
      metadata: { attempt: updated.scrapeAttemptCount, maxAttempts: maxScrapeAttempts },
    });
    return "failed";
  }

  await jobApplications.addEvent({
    jobApplicationId,
    type: "processing",
    title: "Scraping retry scheduled",
    body: input.reason,
    metadata: {
      attempt: updated.scrapeAttemptCount,
      maxAttempts: maxScrapeAttempts,
      ...(updated.nextScrapeAttemptAt
        ? { nextAttemptAt: updated.nextScrapeAttemptAt.toISOString() }
        : {}),
    },
  });

  return "retry_scheduled";
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

async function storeCompanyLogo(
  jobApplicationId: string,
  scrape: ScrapeBundle,
  remoteImages: RemoteImageFetcher,
  storage: FileStorage,
  jobApplications: JobApplicationRepository,
): Promise<void> {
  const companyWithLogo = scrape.companyLinkedIn?.logoUrl
    ? scrape.companyLinkedIn
    : scrape.companyWebsite?.logoUrl
      ? scrape.companyWebsite
      : scrape.careerPage?.logoUrl
        ? scrape.careerPage
        : undefined;

  const logoUrl = companyWithLogo?.logoUrl;

  if (!logoUrl) {
    return;
  }

  try {
    const image = await remoteImages.fetch(logoUrl);
    const stored = await storage.put({
      fileName: `company-logo.${extensionForContentType(image.contentType)}`,
      contentType: image.contentType,
      body: image.body,
      metadata: {
        jobApplicationId,
        kind: "company_logo",
        companyName: companyWithLogo.name,
      },
    });

    const updatedCompany = { ...companyWithLogo, logoFileId: stored.id };
    const updatedScrape: ScrapeBundle = {
      ...scrape,
      companyLinkedIn:
        scrape.companyLinkedIn === companyWithLogo ? updatedCompany : scrape.companyLinkedIn,
      companyWebsite:
        scrape.companyWebsite === companyWithLogo ? updatedCompany : scrape.companyWebsite,
      careerPage: scrape.careerPage === companyWithLogo ? updatedCompany : scrape.careerPage,
    };
    await jobApplications.saveScrapeBundle(jobApplicationId, updatedScrape);
  } catch {
    // Logo download is optional
  }
}

function extensionForContentType(contentType: string): string {
  switch (contentType) {
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "png";
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

function currentUser(request: Request): AuthenticatedRequest["user"] {
  return (request as AuthenticatedRequest).user;
}
