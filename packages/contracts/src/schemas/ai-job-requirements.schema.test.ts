import { describe, expect, it } from "vitest";
import { aiJobRequirementsSchema } from "./ai-job-requirements.schema.js";

describe("aiJobRequirementsSchema", () => {
  it("accepts concise extracted job requirements", () => {
    expect(() =>
      aiJobRequirementsSchema.parse({
        requirements: [
          "5+ years of TypeScript experience",
          "Experience building distributed backend services",
        ],
      }),
    ).not.toThrow();
  });

  it("rejects empty requirement lists", () => {
    expect(() =>
      aiJobRequirementsSchema.parse({
        requirements: [],
      }),
    ).toThrow();
  });

  it("rejects empty requirement text", () => {
    expect(() =>
      aiJobRequirementsSchema.parse({
        requirements: ["TypeScript", ""],
      }),
    ).toThrow();
  });
});
