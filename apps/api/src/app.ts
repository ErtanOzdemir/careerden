import cors from "cors";
import express from "express";
import type { Express } from "express";
import { CreateProfileUseCase, SubmitJobApplicationUseCase } from "@link2cv/application";
import { createJobApplicationRouter } from "./routes/job-applications.routes.js";
import { createLinkedInSessionRouter } from "./routes/linkedin-session.routes.js";
import { createProfileRouter } from "./routes/profiles.routes.js";
import { errorHandler } from "./middleware/error-handler.js";
import {
  createApiDependencies,
  type ApiAppOptions,
} from "./composition-root.js";

export type { ApiAppOptions } from "./composition-root.js";

export function createApiApp(options: ApiAppOptions = {}): Express {
  const { profiles, jobApplications, queue, storage, linkedInSessionManager } =
    createApiDependencies(options);

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
      profiles,
    }),
  );

  app.use(
    "/job-applications",
    createJobApplicationRouter({
      submitJobApplication: new SubmitJobApplicationUseCase(
        jobApplications,
        profiles,
        queue,
      ),
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
