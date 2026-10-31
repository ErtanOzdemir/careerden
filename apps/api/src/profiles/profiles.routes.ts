import { Router } from "express";
import type { Request, Router as ExpressRouter } from "express";
import type { CreateProfileUseCase } from "../application/profiles/create-profile.use-case.js";
import type { GetOrCreateCurrentProfileUseCase } from "../application/profiles/get-or-create-current-profile.use-case.js";
import type { GetProfileUseCase } from "../application/profiles/get-profile.use-case.js";
import type { UpdateOnboardingStateUseCase } from "../application/profiles/update-onboarding-state.use-case.js";
import type { UpdateProfileUseCase } from "../application/profiles/update-profile.use-case.js";
import {
  createProfileSchema,
  updateOnboardingStateSchema,
  updateProfileSchema,
} from "../contracts/profiles/profile.schema.js";
import { validateBody } from "../middleware/validate-body.js";
import type { AuthenticatedRequest } from "../auth/session.middleware.js";

export function createProfileRouter(dependencies: {
  createProfile: CreateProfileUseCase;
  getCurrentProfile: GetOrCreateCurrentProfileUseCase;
  getProfile: GetProfileUseCase;
  updateProfile: UpdateProfileUseCase;
  updateOnboardingState: UpdateOnboardingStateUseCase;
}): ExpressRouter {
  const router = Router();

  router.get("/me", async (request, response, next) => {
    try {
      response.json(await dependencies.getCurrentProfile.execute(currentUser(request)));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/me", validateBody(updateProfileSchema), async (request, response, next) => {
    try {
      const user = currentUser(request);
      const profile = await dependencies.getCurrentProfile.execute(user);
      const updated = await dependencies.updateProfile.execute(profile.id, user.id, request.body);

      response.json(updated);
    } catch (error) {
      next(error);
    }
  });

  router.patch(
    "/me/onboarding",
    validateBody(updateOnboardingStateSchema),
    async (request, response, next) => {
      try {
        const user = currentUser(request);
        const profile = await dependencies.getCurrentProfile.execute(user);
        const updated = await dependencies.updateOnboardingState.execute(
          profile.id,
          user.id,
          request.body,
        );

        response.json(updated);
      } catch (error) {
        next(error);
      }
    },
  );

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
      response.json(
        await dependencies.getProfile.execute(request.params.id, currentUser(request).id),
      );
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:id", validateBody(updateProfileSchema), async (request, response, next) => {
    try {
      response.json(
        await dependencies.updateProfile.execute(
          request.params.id,
          currentUser(request).id,
          request.body,
        ),
      );
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function currentUser(request: Request): AuthenticatedRequest["user"] {
  return (request as AuthenticatedRequest).user;
}
