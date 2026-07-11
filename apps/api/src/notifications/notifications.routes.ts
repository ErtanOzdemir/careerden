import { Router } from "express";
import type { Request, Router as ExpressRouter } from "express";
import type {
  CountUnreadNotificationsUseCase,
  ListNotificationsUseCase,
  MarkAllNotificationsReadUseCase,
  MarkNotificationReadUseCase,
} from "@link2cv/application";
import type { AuthenticatedRequest } from "../auth/session.middleware.js";

export function createNotificationRouter(dependencies: {
  listNotifications: ListNotificationsUseCase;
  countUnreadNotifications: CountUnreadNotificationsUseCase;
  markNotificationRead: MarkNotificationReadUseCase;
  markAllNotificationsRead: MarkAllNotificationsReadUseCase;
}) {
  const router: ExpressRouter = Router();

  router.get("/", async (request, response, next) => {
    try {
      response.json(await dependencies.listNotifications.execute(currentUser(request)));
    } catch (error) {
      next(error);
    }
  });

  router.get("/unread-count", async (request, response, next) => {
    try {
      const count = await dependencies.countUnreadNotifications.execute(currentUser(request));
      response.json({ count });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:id/read", async (request, response, next) => {
    try {
      response.json(
        await dependencies.markNotificationRead.execute(request.params.id, currentUser(request)),
      );
    } catch (error) {
      next(error);
    }
  });

  router.patch("/read-all", async (request, response, next) => {
    try {
      await dependencies.markAllNotificationsRead.execute(currentUser(request));
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
