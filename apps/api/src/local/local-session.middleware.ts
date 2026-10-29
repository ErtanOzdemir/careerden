import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedRequest, AuthenticatedUser } from "../auth/session.middleware.js";

export const localSessionTokenHeader = "x-careerden-local-token";

// Authenticates requests from the desktop shell that launched this runtime. The shell generates the
// token per launch and adds it to every proxied request, so other local processes cannot call in.
export function localSession(token: string, user: AuthenticatedUser) {
  const expected = Buffer.from(token);

  return (request: Request, response: Response, next: NextFunction) => {
    const provided = request.header(localSessionTokenHeader);
    const actual = Buffer.from(provided ?? "");

    if (!provided || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      response.status(401).json({ code: "unauthorized", error: "Unauthorized" });
      return;
    }

    (request as AuthenticatedRequest).user = user;
    next();
  };
}
