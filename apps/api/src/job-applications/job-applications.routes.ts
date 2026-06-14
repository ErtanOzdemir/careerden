import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import type { SubmitJobApplicationUseCase } from "@link2cv/application";
import type {
  FileStorage,
  GeneratedDocument,
  JobApplication,
  JobApplicationRepository,
} from "@link2cv/domain";
import { createJobApplicationSchema } from "@link2cv/contracts";
import { validateBody } from "../middleware/validate-body.js";

export type JobApplicationWithDocuments = JobApplication & {
  documents: GeneratedDocument[];
};

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

      const jobApplicationsWithDocuments = await listJobApplicationsWithDocuments(
        dependencies.jobApplications,
        profileId,
      );

      response.json(jobApplicationsWithDocuments);
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

      const documents = await dependencies.jobApplications.listGeneratedDocuments(
        request.params.id,
      );
      response.json({ ...jobApplication, documents });
    } catch (error) {
      next(error);
    }
  });

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

export async function listJobApplicationsWithDocuments(
  jobApplications: JobApplicationRepository,
  profileId: string,
): Promise<JobApplicationWithDocuments[]> {
  const jobs = await jobApplications.listByProfileId(profileId);

  return Promise.all(
    jobs.map(async (jobApplication) => ({
      ...jobApplication,
      documents: await jobApplications.listGeneratedDocuments(jobApplication.id),
    })),
  );
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
