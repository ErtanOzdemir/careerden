import { Router } from "express";
import type { LocalFileStorage } from "@careerden/infrastructure";

// Serves LocalFileStorage downloads. The signed URL is the credential, so this mounts ahead of
// session authentication like the S3 presigned URLs it replaces.
export function createLocalFileRouter(storage: LocalFileStorage): Router {
  const router = Router();

  router.get("/:fileId", async (request, response, next) => {
    const { expires, signature } = request.query;
    const fileId = request.params.fileId;

    if (
      typeof expires !== "string" ||
      typeof signature !== "string" ||
      !storage.verifySignedUrl({ fileId, expires, signature })
    ) {
      response.status(403).json({ code: "forbidden", error: "Invalid or expired file link" });
      return;
    }

    try {
      const file = await storage.get(fileId);
      response
        .status(200)
        .type(file.contentType)
        .setHeader("Cache-Control", "private, no-store")
        .send(file.body);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        response.status(404).json({ code: "not_found", error: "File not found" });
        return;
      }
      next(error);
    }
  });

  return router;
}
