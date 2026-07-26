import { describe, expect, it } from "vitest";
import { ApplicationError } from "@careerden/application";
import { parseCompanyLogoUpload } from "./company-logo-upload.js";

describe("parseCompanyLogoUpload", () => {
  it("accepts a PNG whose signature matches its content type", () => {
    const result = parseCompanyLogoUpload(
      createFile("image/png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])),
    );

    expect(result).toMatchObject({
      contentType: "image/png",
      fileName: "logo.png",
    });
  });

  it("rejects spoofed and unsupported image uploads", () => {
    expect(() => parseCompanyLogoUpload(createFile("image/png", Buffer.from("not-png")))).toThrow(
      ApplicationError,
    );
    expect(() =>
      parseCompanyLogoUpload(createFile("image/svg+xml", Buffer.from("<svg />"))),
    ).toThrow("Company logo must be a valid PNG, JPEG, or WebP image");
  });
});

function createFile(mimetype: string, buffer: Buffer): Express.Multer.File {
  return {
    buffer,
    destination: "",
    encoding: "7bit",
    fieldname: "companyLogo",
    filename: "logo.png",
    mimetype,
    originalname: "logo.png",
    path: "",
    size: buffer.byteLength,
    stream: undefined as never,
  };
}
