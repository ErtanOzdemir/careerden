import type { RequestHandler } from "express";
import multer from "multer";
import { ApplicationError } from "@careerden/application";
import type { ManualCompanyLogo } from "@careerden/application";

const maximumCompanyLogoSize = 5 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fieldSize: 300_000,
    fields: 12,
    fileSize: maximumCompanyLogoSize,
    files: 1,
  },
});

export const uploadCompanyLogo: RequestHandler = (request, response, next) => {
  upload.single("companyLogo")(request, response, (error) => {
    next(toCompanyLogoUploadError(error));
  });
};

export function parseCompanyLogoUpload(
  file: Express.Multer.File | undefined,
): ManualCompanyLogo | undefined {
  if (!file) return undefined;

  const contentType = file.mimetype.toLowerCase();
  if (!isSupportedImage(contentType, file.buffer)) {
    throw new ApplicationError(
      "validation",
      "Company logo must be a valid PNG, JPEG, or WebP image",
    );
  }

  return {
    body: file.buffer,
    contentType: contentType as ManualCompanyLogo["contentType"],
    fileName: file.originalname,
  };
}

export function toCompanyLogoUploadError(error: unknown): unknown {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    return new ApplicationError("validation", "Company logo must not exceed 5 MB");
  }
  if (error instanceof multer.MulterError && error.code === "LIMIT_UNEXPECTED_FILE") {
    return new ApplicationError(
      "validation",
      "Upload must contain at most one company logo named companyLogo",
    );
  }
  if (error instanceof multer.MulterError) {
    return new ApplicationError("validation", "Invalid manual application upload");
  }
  return error;
}

function isSupportedImage(contentType: string, body: Buffer): boolean {
  if (contentType === "image/png") {
    return body
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (contentType === "image/jpeg") {
    return body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff;
  }
  if (contentType === "image/webp") {
    return (
      body.subarray(0, 4).toString("ascii") === "RIFF" &&
      body.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  return false;
}
