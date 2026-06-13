import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import type { SubmitJobApplicationUseCase } from "@link2cv/application";
import type { FileStorage, JobApplicationRepository } from "@link2cv/domain";
import { createJobApplicationSchema } from "@link2cv/contracts";
import { validateBody } from "../middleware/validate-body.js";

export function createJobApplicationRouter(dependencies: {
  submitJobApplication: SubmitJobApplicationUseCase;
  jobApplications: JobApplicationRepository;
  storage: FileStorage;
}): ExpressRouter {
  const router = Router();

  router.post("/", validateBody(createJobApplicationSchema), async (request, response, next) => {
    try {
      const jobApplication = await dependencies.submitJobApplication.execute(request.body);
      response.status(201).json(jobApplication);
    } catch (error) {
      next(error);
    }
  });

  router.get("/", async (request, response, next) => {
    try {
      const profileId = request.query.profileId;

      if (typeof profileId !== "string") {
        response.status(400).json({ error: "profileId query parameter is required" });
        return;
      }

      const jobApplications = await dependencies.jobApplications.listByProfileId(profileId);
      response.json(jobApplications);
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

      const documents = await dependencies.jobApplications.listGeneratedDocuments(request.params.id);
      response.json({ ...jobApplication, documents });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id/documents/:documentId/download", async (request, response, next) => {
    try {
      const documents = await dependencies.jobApplications.listGeneratedDocuments(request.params.id);
      const document = documents.find((item) => item.id === request.params.documentId);

      if (!document) {
        response.status(404).json({ error: "Document not found" });
        return;
      }

      const url = await dependencies.storage.getSignedUrl(document.fileId);
      response.json({ url });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
