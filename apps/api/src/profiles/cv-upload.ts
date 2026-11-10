import type { RequestHandler } from "express";
import multer from "multer";
import { ApplicationError } from "@careerden/application";
import type { CvFile, CvFileKind } from "../domain/profiles/cv-text-extractor.js";

const maximumCvSize = 10 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fields: 0,
    fileSize: maximumCvSize,
    files: 1,
  },
});

const unsupportedCvMessage = "Upload your CV as a PDF, Word (.docx), or plain text file";

export const uploadCv: RequestHandler = (request, response, next) => {
  upload.single("cv")(request, response, (error) => {
    next(toCvUploadError(error));
  });
};

/** Identifies the file by its content, using the name and MIME type only to tell DOCX from zip. */
export function parseCvUpload(file: Express.Multer.File | undefined): CvFile {
  if (!file) {
    throw new ApplicationError("validation", "Choose a CV file to upload");
  }

  const kind = detectCvKind(file);
  if (!kind) {
    throw new ApplicationError("validation", unsupportedCvMessage);
  }

  return { kind, body: file.buffer };
}

export function toCvUploadError(error: unknown): unknown {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    return new ApplicationError("validation", "CV must not exceed 10 MB");
  }
  if (error instanceof multer.MulterError) {
    return new ApplicationError("validation", "Upload must contain one CV file named cv");
  }
  return error;
}

function detectCvKind(file: Express.Multer.File): CvFileKind | undefined {
  const body = file.buffer;
  const name = file.originalname.toLowerCase();
  const contentType = file.mimetype.toLowerCase();

  if (body.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
  if (
    body.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) &&
    (name.endsWith(".docx") ||
      contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
  ) {
    return "docx";
  }
  if ((name.endsWith(".txt") || contentType === "text/plain") && isUtf8Text(body)) {
    return "text";
  }
  return undefined;
}

function isUtf8Text(body: Buffer): boolean {
  if (body.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(body);
    return true;
  } catch {
    return false;
  }
}
