import { Router } from "express";
import type { Request, Router as ExpressRouter } from "express";
import type {
  CountUnreadNotificationsUseCase,
  GetOrCreateCurrentProfileUseCase,
  ListNotificationsUseCase,
  MarkAllNotificationsReadUseCase,
  MarkNotificationReadUseCase,
} from "@link2cv/application";
import type { NotificationChangeSubscriber } from "@link2cv/domain";
import type { AuthenticatedRequest } from "../auth/session.middleware.js";

export function createNotificationRouter(dependencies: {
  listNotifications: ListNotificationsUseCase;
  countUnreadNotifications: CountUnreadNotificationsUseCase;
  markNotificationRead: MarkNotificationReadUseCase;
  markAllNotificationsRead: MarkAllNotificationsReadUseCase;
  getCurrentProfile: Pick<GetOrCreateCurrentProfileUseCase, "execute">;
  notificationChanges: NotificationChangeSubscriber;
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

  router.get("/stream", async (request, response, next) => {
    try {
      const profile = await dependencies.getCurrentProfile.execute(currentUser(request));

      response.status(200);
      response.set({
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream",
        "X-Accel-Buffering": "no",
      });
      response.flushHeaders();
      response.write(": connected\n\n");

      const unsubscribe = await dependencies.notificationChanges.subscribe(profile.id, (change) => {
        response.write(`event: ${change.type}\n`);
        response.write(`data: ${JSON.stringify(change)}\n\n`);
      });
      const heartbeat = setInterval(() => {
        response.write(": heartbeat\n\n");
      }, 20_000);

      request.on("close", () => {
        clearInterval(heartbeat);
        unsubscribe();
        response.end();
      });
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
