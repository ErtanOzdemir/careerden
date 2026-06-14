import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import type { CreateProfileUseCase } from "@link2cv/application";
import { createProfileSchema } from "@link2cv/contracts";
import type { UserProfileRepository } from "@link2cv/domain";
import { validateBody } from "../middleware/validate-body.js";

export function createProfileRouter(dependencies: {
  createProfile: CreateProfileUseCase;
  profiles: UserProfileRepository;
}): ExpressRouter {
  const router = Router();

  router.post("/", validateBody(createProfileSchema), async (request, response, next) => {
    try {
      const profile = await dependencies.createProfile.execute(request.body);
      response.status(201).json(profile);
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id", async (request, response, next) => {
    try {
      const profile = await dependencies.profiles.findById(request.params.id);

      if (!profile) {
        response.status(404).json({ error: "Profile not found" });
        return;
      }

      response.json(profile);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
