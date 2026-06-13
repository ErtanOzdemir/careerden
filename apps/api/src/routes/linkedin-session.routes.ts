import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import type { LinkedInSessionManager } from "@link2cv/infrastructure";

export function createLinkedInSessionRouter(dependencies: {
  linkedInSessionManager: LinkedInSessionManager;
}): ExpressRouter {
  const router = Router();

  router.post("/start", async (_request, response, next) => {
    try {
      response.json(await dependencies.linkedInSessionManager.startLogin());
    } catch (error) {
      next(error);
    }
  });

  router.post("/save", async (_request, response, next) => {
    try {
      response.json(await dependencies.linkedInSessionManager.saveLogin());
    } catch (error) {
      next(error);
    }
  });

  router.get("/status", async (_request, response, next) => {
    try {
      response.json(await dependencies.linkedInSessionManager.getStatus());
    } catch (error) {
      next(error);
    }
  });

  return router;
}
