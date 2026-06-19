import cors from "cors";
import express from "express";
import type { Express } from "express";
import {
  CreateProfileUseCase,
  DeleteJobApplicationUseCase,
  GenerateDocumentsUseCase,
  GenerateJobApplicationDocumentsUseCase,
  RetryJobApplicationUseCase,
  SubmitJobApplicationUseCase,
  UpdateProfileUseCase,
} from "@link2cv/application";
import { createJobApplicationRouter } from "./job-applications/job-applications.routes.js";
import { createLinkedInSessionRouter } from "./scraping/linkedin-session.routes.js";
import { createProfileRouter } from "./profiles/profiles.routes.js";
import { errorHandler } from "./middleware/error-handler.js";
import { createApiDependencies, type ApiAppOptions } from "./composition-root.js";

export type { ApiAppOptions } from "./composition-root.js";

export function createApiApp(options: ApiAppOptions = {}): Express {
  const {
    profiles,
    jobApplications,
    queue,
    storage,
    templates,
    documents,
    docxTemplates,
    linkedInSessionManager,
  } = createApiDependencies(options);

  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.use(
    "/profiles",
    createProfileRouter({
      createProfile: new CreateProfileUseCase(profiles),
      updateProfile: new UpdateProfileUseCase(profiles),
      profiles,
      storage,
      docxTemplates,
    }),
  );

  app.use(
    "/job-applications",
    createJobApplicationRouter({
      submitJobApplication: new SubmitJobApplicationUseCase(jobApplications, profiles, queue),
      generateJobApplicationDocuments: new GenerateJobApplicationDocumentsUseCase(
        jobApplications,
        profiles,
        new GenerateDocumentsUseCase(
          templates,
          documents,
          storage,
          jobApplications,
          profiles,
          docxTemplates,
        ),
      ),
      deleteJobApplication: new DeleteJobApplicationUseCase(jobApplications, storage),
      retryJobApplication: new RetryJobApplicationUseCase(jobApplications, queue, storage),
      jobApplications,
      storage,
    }),
  );

  app.use(
    "/linkedin-session",
    createLinkedInSessionRouter({
      linkedInSessionManager,
    }),
  );

  app.use(errorHandler);

  return app;
}
