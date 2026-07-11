import { Router } from "express";
import type { Request, Router as ExpressRouter } from "express";
import type {
  DeleteJobApplicationUseCase,
  GenerateDocumentsWithAiUseCase,
  GenerateJobApplicationDocumentsUseCase,
  RetryJobApplicationUseCase,
  SubmitJobApplicationUseCase,
  UpdateDocumentContentUseCase,
  EnsureJobApplicationAccessUseCase,
  GetJobApplicationAnalyticsUseCase,
  GetJobApplicationDetailUseCase,
  ListJobApplicationsUseCase,
  RequestJobApplicationAnalysisUseCase,
  UpdateJobApplicationStatusUseCase,
  UpdateJobApplicationTrackingUseCase,
  ClaimNextScrapeJobUseCase,
  CreateJobApplicationFromScrapeUseCase,
  FailScrapeJobUseCase,
  RenewScrapeClaimUseCase,
  SubmitJobApplicationScrapeDataUseCase,
  GetProfileUseCase,
  CreateJobApplicationEventUseCase,
  ListJobApplicationEventsUseCase,
  CreateJobApplicationContactUseCase,
  ListJobApplicationContactsUseCase,
  UpdateJobApplicationContactUseCase,
  DeleteJobApplicationContactUseCase,
  CreateJobApplicationFollowUpUseCase,
  ListJobApplicationFollowUpsUseCase,
  UpdateJobApplicationFollowUpUseCase,
  DeleteJobApplicationFollowUpUseCase,
  GetGeneratedDocumentDownloadUrlUseCase,
} from "@link2cv/application";
import type { JobApplicationChangeSubscriber } from "@link2cv/domain";
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

export function createJobApplicationRouter(dependencies: {
  submitJobApplication: SubmitJobApplicationUseCase;
  deleteJobApplication: DeleteJobApplicationUseCase;
  generateJobApplicationDocuments: GenerateJobApplicationDocumentsUseCase;
  retryJobApplication: RetryJobApplicationUseCase;
  updateDocumentContent: UpdateDocumentContentUseCase;
  ensureJobApplicationAccess: EnsureJobApplicationAccessUseCase;
  updateJobApplicationStatus: UpdateJobApplicationStatusUseCase;
  listJobApplications: ListJobApplicationsUseCase;
  getJobApplicationAnalytics: GetJobApplicationAnalyticsUseCase;
  getJobApplicationDetail: GetJobApplicationDetailUseCase;
  updateJobApplicationTracking: UpdateJobApplicationTrackingUseCase;
  requestJobApplicationAnalysis: RequestJobApplicationAnalysisUseCase;
  claimNextScrapeJob: ClaimNextScrapeJobUseCase;
  createJobApplicationFromScrape: CreateJobApplicationFromScrapeUseCase;
  renewScrapeClaim: RenewScrapeClaimUseCase;
  failScrapeJob: FailScrapeJobUseCase;
  submitJobApplicationScrapeData: SubmitJobApplicationScrapeDataUseCase;
  getProfile: GetProfileUseCase;
  jobApplicationChanges: JobApplicationChangeSubscriber;
  generateWithAi?: GenerateDocumentsWithAiUseCase;
  createJobApplicationEvent: CreateJobApplicationEventUseCase;
  listJobApplicationEvents: ListJobApplicationEventsUseCase;
  createJobApplicationContact: CreateJobApplicationContactUseCase;
  listJobApplicationContacts: ListJobApplicationContactsUseCase;
  updateJobApplicationContact: UpdateJobApplicationContactUseCase;
  deleteJobApplicationContact: DeleteJobApplicationContactUseCase;
  createJobApplicationFollowUp: CreateJobApplicationFollowUpUseCase;
  listJobApplicationFollowUps: ListJobApplicationFollowUpsUseCase;
  updateJobApplicationFollowUp: UpdateJobApplicationFollowUpUseCase;
  deleteJobApplicationFollowUp: DeleteJobApplicationFollowUpUseCase;
  getGeneratedDocumentDownloadUrl: GetGeneratedDocumentDownloadUrlUseCase;
}): ExpressRouter {
  const router = Router();

  router.param("id", async (request, response, next, id: string) => {
    try {
      await dependencies.ensureJobApplicationAccess.execute(id, currentUser(request).id);
      next();
    } catch (error) {
      next(error);
    }
  });

  router.put("/:id/status", validateBody(updateStatusSchema), async (request, response, next) => {
    try {
      response.json(
        await dependencies.updateJobApplicationStatus.execute(
          request.params.id,
          currentUser(request).id,
          request.body.status,
        ),
      );
    } catch (error) {
      next(error);
    }
  });

  router.put(
    "/:id/scrape-data",
    validateBody(submitScrapeDataSchema),
    async (request, response, next) => {
      try {
        response.json(
          await dependencies.submitJobApplicationScrapeData.execute(
            request.params.id,
            currentUser(request).id,
            request.body,
          ),
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
      await dependencies.getProfile.execute(profileId, currentUser(request).id);

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
      const jobApplication = await dependencies.submitJobApplication.execute(
        request.body,
        currentUser(request).id,
      );
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
        const claimed = await dependencies.claimNextScrapeJob.execute(
          currentUser(request),
          request.body.claimedBy,
        );

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
        const jobApplication = await dependencies.createJobApplicationFromScrape.execute(
          currentUser(request),
          request.body,
        );

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

      const jobApplicationsWithDocuments = await dependencies.listJobApplications.execute(
        result.data.profileId,
        currentUser(request).id,
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

      response.json(
        await dependencies.getJobApplicationAnalytics.execute(
          result.data.profileId,
          currentUser(request).id,
        ),
      );
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id", async (request, response, next) => {
    try {
      response.json(
        await dependencies.getJobApplicationDetail.execute(
          request.params.id,
          currentUser(request).id,
        ),
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
        const updated = await dependencies.updateJobApplicationTracking.execute(
          request.params.id,
          currentUser(request).id,
          request.body,
        );

        response.json(updated);
      } catch (error) {
        next(error);
      }
    },
  );

  router.delete("/:id", async (request, response, next) => {
    try {
      await dependencies.deleteJobApplication.execute(request.params.id, currentUser(request).id);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.post("/:id/retry", async (request, response, next) => {
    try {
      const retried = await dependencies.retryJobApplication.execute(
        request.params.id,
        currentUser(request).id,
      );
      response.status(202).json(retried.jobApplication);
    } catch (error) {
      next(error);
    }
  });

  router.post("/:id/analysis", async (request, response, next) => {
    try {
      const requested = await dependencies.requestJobApplicationAnalysis.execute(
        request.params.id,
        currentUser(request).id,
      );
      response.status(202).json(requested);
    } catch (error) {
      next(error);
    }
  });

  router.post("/:id/scraping/retry", async (request, response, next) => {
    try {
      const retried = await dependencies.retryJobApplication.execute(
        request.params.id,
        currentUser(request).id,
        { mode: "scraping" },
      );
      response.status(202).json(retried.jobApplication);
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/:id/scraping/heartbeat",
    validateBody(heartbeatScrapeJobSchema),
    async (request, response, next) => {
      try {
        const renewed = await dependencies.renewScrapeClaim.execute(
          request.params.id,
          currentUser(request).id,
          request.body.claimedBy,
        );

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
        const failed = await dependencies.failScrapeJob.execute(
          request.params.id,
          currentUser(request).id,
          request.body,
        );

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
        const event = await dependencies.createJobApplicationEvent.execute(
          request.params.id,
          currentUser(request).id,
          request.body,
        );

        response.status(201).json(event);
      } catch (error) {
        next(error);
      }
    },
  );

  router.get("/:id/events", async (request, response, next) => {
    try {
      response.json(
        await dependencies.listJobApplicationEvents.execute(
          request.params.id,
          currentUser(request).id,
        ),
      );
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/:id/contacts",
    validateBody(createJobApplicationContactSchema),
    async (request, response, next) => {
      try {
        const contact = await dependencies.createJobApplicationContact.execute(
          request.params.id,
          currentUser(request).id,
          request.body,
        );

        response.status(201).json(contact);
      } catch (error) {
        next(error);
      }
    },
  );

  router.get("/:id/contacts", async (request, response, next) => {
    try {
      response.json(
        await dependencies.listJobApplicationContacts.execute(
          request.params.id,
          currentUser(request).id,
        ),
      );
    } catch (error) {
      next(error);
    }
  });

  router.patch(
    "/:id/contacts/:contactId",
    validateBody(updateJobApplicationContactSchema),
    async (request, response, next) => {
      try {
        response.json(
          await dependencies.updateJobApplicationContact.execute(
            request.params.id,
            request.params.contactId,
            currentUser(request).id,
            request.body,
          ),
        );
      } catch (error) {
        next(error);
      }
    },
  );

  router.delete("/:id/contacts/:contactId", async (request, response, next) => {
    try {
      await dependencies.deleteJobApplicationContact.execute(
        request.params.id,
        request.params.contactId,
        currentUser(request).id,
      );
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
        const followUp = await dependencies.createJobApplicationFollowUp.execute(
          request.params.id,
          currentUser(request).id,
          request.body,
        );

        response.status(201).json(followUp);
      } catch (error) {
        next(error);
      }
    },
  );

  router.get("/:id/follow-ups", async (request, response, next) => {
    try {
      response.json(
        await dependencies.listJobApplicationFollowUps.execute(
          request.params.id,
          currentUser(request).id,
        ),
      );
    } catch (error) {
      next(error);
    }
  });

  router.patch(
    "/:id/follow-ups/:followUpId",
    validateBody(updateJobApplicationFollowUpSchema),
    async (request, response, next) => {
      try {
        const updated = await dependencies.updateJobApplicationFollowUp.execute(
          request.params.id,
          request.params.followUpId,
          currentUser(request).id,
          request.body,
        );

        response.json(updated);
      } catch (error) {
        next(error);
      }
    },
  );

  router.delete("/:id/follow-ups/:followUpId", async (request, response, next) => {
    try {
      await dependencies.deleteJobApplicationFollowUp.execute(
        request.params.id,
        request.params.followUpId,
        currentUser(request).id,
      );
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
          currentUser(request).id,
          request.body.documentContent,
        );

        response.json({ documentContent });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post("/:id/documents/generate", async (request, response, next) => {
    try {
      await dependencies.generateJobApplicationDocuments.execute(request.params.id);

      response
        .status(201)
        .json(
          await dependencies.getJobApplicationDetail.execute(
            request.params.id,
            currentUser(request).id,
          ),
        );
    } catch (error) {
      next(error);
    }
  });

  if (dependencies.generateWithAi) {
    router.post("/:id/documents/generate-with-ai", async (request, response, next) => {
      try {
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

        response
          .status(201)
          .json(
            await dependencies.getJobApplicationDetail.execute(
              request.params.id,
              currentUser(request).id,
            ),
          );
      } catch (error) {
        next(error);
      }
    });
  }

  router.get("/:id/documents/:documentId/download", async (request, response, next) => {
    try {
      const url = await dependencies.getGeneratedDocumentDownloadUrl.execute(
        request.params.id,
        request.params.documentId,
        currentUser(request).id,
      );

      response.json({ url });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function currentUser(request: Request): AuthenticatedRequest["user"] {
  return (request as AuthenticatedRequest).user;
}
