import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import type { Link2CvAuth } from "./auth.js";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

export function requireSession(auth: Link2CvAuth) {
  return async (request: Request, response: Response, next: NextFunction) => {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(request.headers),
      });

      if (!session) {
        response.status(401).json({ error: "Unauthorized" });
        return;
      }

      (request as AuthenticatedRequest).user = {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
      };
      next();
    } catch (error) {
      next(error);
    }
  };
}
