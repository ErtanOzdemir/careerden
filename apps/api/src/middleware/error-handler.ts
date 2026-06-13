import type { NextFunction, Request, Response } from "express";

export function errorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction
) {
  const message = error instanceof Error ? error.message : "Unexpected error";

  response.status(500).json({
    error: message
  });
}
