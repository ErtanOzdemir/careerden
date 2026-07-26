import { describe, expect, it } from "vitest";
import {
  aiJobRequirementsCandidateSchema,
  aiJobRequirementsSchema,
} from "./ai-job-requirements.schema.js";

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

  it("accepts an empty provider candidate list for application-level fallback handling", () => {
    expect(
      aiJobRequirementsCandidateSchema.parse({
        requirements: [],
      }),
    ).toEqual({ requirements: [] });
  });

  it("rejects empty requirement text", () => {
    expect(() =>
      aiJobRequirementsSchema.parse({
        requirements: ["TypeScript", ""],
      }),
    ).toThrow();
  });
});
