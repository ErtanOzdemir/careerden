import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import type {
  CheckLinkedInSessionUseCase,
  SaveLinkedInSessionUseCase,
  StartLinkedInSessionUseCase,
} from "@careerden/application";

export function createLinkedInSessionRouter(dependencies: {
  startLinkedInSession: StartLinkedInSessionUseCase;
  saveLinkedInSession: SaveLinkedInSessionUseCase;
  checkLinkedInSession: CheckLinkedInSessionUseCase;
}): ExpressRouter {
  const router = Router();

  router.post("/start", async (_request, response, next) => {
    try {
      response.json(await dependencies.startLinkedInSession.execute());
    } catch (error) {
      next(error);
    }
  });

  router.post("/save", async (_request, response, next) => {
    try {
      response.json(await dependencies.saveLinkedInSession.execute());
    } catch (error) {
      next(error);
    }
  });

  router.get("/status", async (_request, response, next) => {
    try {
      response.json(await dependencies.checkLinkedInSession.execute());
    } catch (error) {
      next(error);
    }
  });

  return router;
}
