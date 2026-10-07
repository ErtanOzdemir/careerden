import { describe, expect, it } from "vitest";
import {
  applicationPackPreferencesSchema,
  requestApplicationPackGenerationSchema,
} from "./application-pack.schema.js";

describe("applicationPackPreferencesSchema", () => {
  it("applies the automatic professional defaults", () => {
    expect(applicationPackPreferencesSchema.parse({})).toEqual({
      language: "auto",
      tone: "professional",
    });
  });

  it("accepts BCP-47 languages, tones, and separate template selections", () => {
    expect(
      applicationPackPreferencesSchema.parse({
        language: "tr-TR",
        tone: "concise",
        cvTemplateId: "cv-template",
        coverLetterTemplateId: "cover-template",
      }),
    ).toEqual({
      language: "tr-TR",
      tone: "concise",
      cvTemplateId: "cv-template",
      coverLetterTemplateId: "cover-template",
    });
  });

  it("rejects unsupported tones and malformed languages", () => {
    expect(
      applicationPackPreferencesSchema.safeParse({ language: "english", tone: "casual" }).success,
    ).toBe(false);
  });
});

describe("requestApplicationPackGenerationSchema", () => {
  it("accepts an empty request and supplies no focused overrides", () => {
    expect(requestApplicationPackGenerationSchema.parse(undefined)).toEqual({});
  });

  it("rejects unknown generation options", () => {
    expect(() => requestApplicationPackGenerationSchema.parse({ documentType: "cv" })).toThrow();
  });
});
