import { describe, expect, it } from "vitest";
import multer from "multer";
import { ApplicationError } from "@careerden/application";
import { isDocxUpload, toDocumentTemplateUploadError } from "./document-template-upload.js";

const docxContentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

describe("document template upload policy", () => {
  it("requires both a DOCX filename and the DOCX content type", () => {
    expect(isDocxUpload({ originalname: "cv.docx", mimetype: docxContentType })).toBe(true);
    expect(isDocxUpload({ originalname: "cv.exe", mimetype: docxContentType })).toBe(false);
    expect(isDocxUpload({ originalname: "cv.docx", mimetype: "application/octet-stream" })).toBe(
      false,
    );
  });

  it("maps oversized uploads to a safe validation error", () => {
    expect(toDocumentTemplateUploadError(new multer.MulterError("LIMIT_FILE_SIZE"))).toEqual(
      new ApplicationError("validation", "DOCX file must not exceed 5 MB"),
    );
  });

  it("preserves unexpected upload errors", () => {
    const error = new Error("unexpected");

    expect(toDocumentTemplateUploadError(error)).toBe(error);
  });
});
