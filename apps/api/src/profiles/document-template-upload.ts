import type { RequestHandler } from "express";
import multer from "multer";
import { ApplicationError } from "@careerden/application";

const docxContentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const maximumDocxUploadSize = 5 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maximumDocxUploadSize },
});

export const uploadDocumentTemplateFile: RequestHandler = (request, response, next) => {
  upload.single("file")(request, response, (error) => {
    next(toDocumentTemplateUploadError(error));
  });
};

export function isDocxUpload(
  file: Pick<Express.Multer.File, "mimetype" | "originalname">,
): boolean {
  return (
    file.originalname.toLowerCase().endsWith(".docx") &&
    file.mimetype.toLowerCase() === docxContentType
  );
}

export function toDocumentTemplateUploadError(error: unknown): unknown {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    return new ApplicationError(
      "validation",
      `DOCX file must not exceed ${maximumDocxUploadSize / 1024 / 1024} MB`,
    );
  }

  if (error instanceof multer.MulterError && error.code === "LIMIT_UNEXPECTED_FILE") {
    return new ApplicationError("validation", "Upload must contain one DOCX file named file");
  }

  return error;
}
