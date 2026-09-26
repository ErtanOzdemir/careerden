import { Router } from "express";
import type { Request, Router as ExpressRouter } from "express";
import type {
  CreateManualJobApplicationUseCase,
  ArchiveJobApplicationUseCase,
  RestoreJobApplicationUseCase,
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
  RequestApplicationPackGenerationUseCase,
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
  PreviewApplicationPackUseCase,
  ApplyDocumentFieldTipUseCase,
  RewriteCoverLetterUseCase,
} from "@careerden/application";
import type { JobApplicationChangeSubscriber } from "@careerden/domain";
import {
  createJobApplicationFromScrapeSchema,
  claimScrapeJobSchema,
  createJobApplicationContactSchema,
  createJobApplicationEventSchema,
  createJobApplicationFollowUpSchema,
  failScrapeJobSchema,
  heartbeatScrapeJobSchema,
  createJobApplicationSchema,
  createManualJobApplicationSchema,
  jobApplicationAnalyticsQuerySchema,
  listJobApplicationsQuerySchema,
  submitScrapeDataSchema,
  updateJobApplicationContactSchema,
  updateJobApplicationFollowUpSchema,
  updateJobApplicationSchema,
  updateStatusSchema,
  updateDocumentContentSchema,
  requestApplicationPackGenerationSchema,
  applyFieldTipRequestSchema,
  rewriteCoverLetterRequestSchema,
} from "@careerden/contracts";
import { validateBody } from "../middleware/validate-body.js";
import type { AuthenticatedRequest } from "../auth/session.middleware.js";
import { parseCompanyLogoUpload, uploadCompanyLogo } from "./company-logo-upload.js";

export function createJobApplicationRouter(dependencies: {
  createManualJobApplication: CreateManualJobApplicationUseCase;
  archiveJobApplication: ArchiveJobApplicationUseCase;
  restoreJobApplication: RestoreJobApplicationUseCase;
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
  requestApplicationPackGeneration: RequestApplicationPackGenerationUseCase;
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
  previewApplicationPack: PreviewApplicationPackUseCase;
  applyDocumentFieldTip?: ApplyDocumentFieldTipUseCase;
  rewriteCoverLetter?: RewriteCoverLetterUseCase;
}): ExpressRouter {
  const router = Router();

  router.post("/manual", uploadCompanyLogo, async (request, response, next) => {
    try {
      const applicationPackPreferences = parseApplicationPackPreferences(
        request.body.applicationPackPreferences,
      );
      const result = createManualJobApplicationSchema.safeParse({
        ...request.body,
        ...(applicationPackPreferences ? { applicationPackPreferences } : {}),
      });

      if (!result.success) {
        response.status(400).json({
          code: "validation",
          error: "Invalid request body",
          issues: result.error.issues,
        });
        return;
      }

      const jobApplication = await dependencies.createManualJobApplication.execute(
        {
          profileId: result.data.profileId,
          companyName: result.data.companyName!,
          roleTitle: result.data.roleTitle!,
          jobDescription: result.data.jobDescription!,
          applicationPackPreferences: result.data.applicationPackPreferences,
          ...(result.data.companyDescription
            ? { companyDescription: result.data.companyDescription }
            : {}),
          ...(result.data.companyWebsiteUrl
            ? { companyWebsiteUrl: result.data.companyWebsiteUrl }
            : {}),
          ...(result.data.jobLocation ? { jobLocation: result.data.jobLocation } : {}),
          ...(result.data.jobUrl ? { jobUrl: result.data.jobUrl } : {}),
          ...(request.file ? { companyLogo: parseCompanyLogoUpload(request.file) } : {}),
        },
        currentUser(request).id,
      );
      response.status(201).json(jobApplication);
    } catch (error) {
      next(error);
    }
  });

  router.param("id", async (request, response, next, id: string) => {
    try {
      await dependencies.ensureJobApplicationAccess.execute(id, currentUser(request).id);
      next();
    } catch (error) {
      next(error);
    }
  });

  router.put("/:id/archive", async (request, response, next) => {
    try {
      response.json(
        await dependencies.archiveJobApplication.execute(
          request.params.id,
          currentUser(request).id,
        ),
      );
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:id/archive", async (request, response, next) => {
    try {
      response.json(
        await dependencies.restoreJobApplication.execute(
          request.params.id,
          currentUser(request).id,
        ),
      );
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
      response.status(400).json({ code: "validation", error: "profileId is required" });
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
      const jobApplication = request.body.sourceUrl
        ? await dependencies.submitJobApplication.execute(request.body, currentUser(request).id)
        : await dependencies.createManualJobApplication.execute(
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
        response.status(400).json({
          code: "validation",
          error: "Invalid query parameters",
          issues: result.error.issues,
        });
        return;
      }

      const page = await dependencies.listJobApplications.execute(
        result.data.profileId,
        currentUser(request).id,
        result.data,
      );

      response.json(page);
    } catch (error) {
      next(error);
    }
  });

  router.get("/analytics", async (request, response, next) => {
    try {
      const result = jobApplicationAnalyticsQuerySchema.safeParse(request.query);

      if (!result.success) {
        response.status(400).json({
          code: "validation",
          error: "Invalid query parameters",
          issues: result.error.issues,
        });
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

  router.post(
    "/:id/application-pack/generations",
    validateBody(requestApplicationPackGenerationSchema),
    async (request, response, next) => {
      try {
        const generation = await dependencies.requestApplicationPackGeneration.execute({
          jobApplicationId: request.params.id,
          userId: currentUser(request).id,
          ...request.body,
        });
        const application = await dependencies.getJobApplicationDetail.execute(
          request.params.id,
          currentUser(request).id,
        );

        response.status(202).json({ ...generation, application });
      } catch (error) {
        next(error);
      }
    },
  );

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

  if (dependencies.applyDocumentFieldTip) {
    router.post(
      "/:id/document-content/apply-tip",
      validateBody(applyFieldTipRequestSchema),
      async (request, response, next) => {
        try {
          const value = await dependencies.applyDocumentFieldTip!.execute(
            request.params.id,
            currentUser(request).id,
            request.body,
          );

          response.json({ value });
        } catch (error) {
          next(error);
        }
      },
    );
  }

  if (dependencies.rewriteCoverLetter) {
    router.post(
      "/:id/document-content/rewrite-cover-letter",
      validateBody(rewriteCoverLetterRequestSchema),
      async (request, response, next) => {
        try {
          const value = await dependencies.rewriteCoverLetter!.execute(
            request.params.id,
            currentUser(request).id,
            request.body,
          );

          response.json({ value });
        } catch (error) {
          next(error);
        }
      },
    );
  }

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

  router.post(
    "/:id/document-preview",
    validateBody(requestApplicationPackGenerationSchema),
    async (request, response, next) => {
      try {
        const preview = await dependencies.previewApplicationPack.execute(
          request.params.id,
          currentUser(request).id,
          request.body,
        );

        response.json(preview);
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}

function parseApplicationPackPreferences(value: unknown): unknown {
  if (value === undefined || value === "") return undefined;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return Symbol("invalid-application-pack-preferences");
  }
}

function currentUser(request: Request): AuthenticatedRequest["user"] {
  return (request as AuthenticatedRequest).user;
}
