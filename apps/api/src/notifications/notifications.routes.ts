import { Router } from "express";
import type { Request, Router as ExpressRouter } from "express";
import type { NotificationRepository, UserProfile } from "@link2cv/domain";
import type { AuthenticatedRequest } from "../auth/session.middleware.js";

export function createNotificationRouter(dependencies: {
  notifications: NotificationRepository;
  getProfileForUser: (user: AuthenticatedRequest["user"]) => Promise<UserProfile>;
}) {
  const router: ExpressRouter = Router();

  router.get("/", async (request, response, next) => {
    try {
      const profile = await dependencies.getProfileForUser(currentUser(request));
      response.json(await dependencies.notifications.listByProfileId(profile.id));
    } catch (error) {
      next(error);
    }
  });

  router.get("/unread-count", async (request, response, next) => {
    try {
      const profile = await dependencies.getProfileForUser(currentUser(request));
      const count = await dependencies.notifications.countUnreadByProfileId(profile.id);
      response.json({ count });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:id/read", async (request, response, next) => {
    try {
      const profile = await dependencies.getProfileForUser(currentUser(request));
      const notification = await dependencies.notifications.findById(request.params.id);

      if (!notification || notification.profileId !== profile.id) {
        response.status(404).json({ error: "Notification not found" });
        return;
      }

      response.json(await dependencies.notifications.markRead(request.params.id));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/read-all", async (request, response, next) => {
    try {
      const profile = await dependencies.getProfileForUser(currentUser(request));
      await dependencies.notifications.markAllRead(profile.id);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function currentUser(request: Request) {
  return (request as AuthenticatedRequest).user;
}
