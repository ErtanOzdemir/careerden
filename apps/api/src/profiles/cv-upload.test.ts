import multer from "multer";
import { describe, expect, it } from "vitest";
import { ApplicationError } from "@careerden/application";
import { parseCvUpload, toCvUploadError } from "./cv-upload.js";

function upload(body: Buffer, originalname: string, mimetype: string): Express.Multer.File {
  return { buffer: body, originalname, mimetype } as Express.Multer.File;
}

const zipHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);

describe("parseCvUpload", () => {
  it("identifies PDF, DOCX, and plain text CVs by content", () => {
    expect(parseCvUpload(upload(Buffer.from("%PDF-1.7"), "cv.bin", "")).kind).toBe("pdf");
    expect(parseCvUpload(upload(zipHeader, "CV.DOCX", "application/octet-stream")).kind).toBe(
      "docx",
    );
    expect(parseCvUpload(upload(Buffer.from("Ada Lovelace"), "cv.txt", "")).kind).toBe("text");
  });

  it("rejects missing, unsupported, and binary files", () => {
    expect(() => parseCvUpload(undefined)).toThrow("Choose a CV file to upload");
    for (const file of [
      upload(zipHeader, "cv.zip", "application/zip"),
      upload(Buffer.from([0xff, 0xd8, 0xff]), "cv.jpg", "image/jpeg"),
      upload(Buffer.from([0x41, 0x00, 0x42]), "cv.txt", "text/plain"),
      upload(Buffer.from([0xc3, 0x28]), "cv.txt", "text/plain"),
    ]) {
      expect(() => parseCvUpload(file)).toThrow(ApplicationError);
    }
  });
});

describe("toCvUploadError", () => {
  it("translates multer limits into validation errors", () => {
    expect(toCvUploadError(new multer.MulterError("LIMIT_FILE_SIZE"))).toEqual(
      new ApplicationError("validation", "CV must not exceed 10 MB"),
    );
    expect(toCvUploadError(new multer.MulterError("LIMIT_UNEXPECTED_FILE"))).toEqual(
      new ApplicationError("validation", "Upload must contain one CV file named cv"),
    );
  });
});
