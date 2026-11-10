import { Router } from "express";
import type { ReadSignedFileUseCase } from "../application/storage/read-signed-file.use-case.js";

// Serves LocalFileStorage downloads. The signed URL is the credential, so this mounts ahead of
// session authentication like the S3 presigned URLs it replaces.
export function createLocalFileRouter(dependencies: {
  readSignedFile: Pick<ReadSignedFileUseCase, "execute">;
}): Router {
  const router = Router();

  router.get("/:fileId", async (request, response, next) => {
    const { expires, signature } = request.query;

    try {
      const file = await dependencies.readSignedFile.execute({
        fileId: request.params.fileId,
        ...(typeof expires === "string" ? { expires } : {}),
        ...(typeof signature === "string" ? { signature } : {}),
      });
      response
        .status(200)
        .type(file.contentType)
        .setHeader("Cache-Control", "private, no-store")
        .send(file.body);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
