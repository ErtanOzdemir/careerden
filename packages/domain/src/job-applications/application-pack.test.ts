import { describe, expect, it } from "vitest";
import { normalizeApplicationPackPreferences } from "./application-pack.js";

describe("normalizeApplicationPackPreferences", () => {
  it("falls back safely when persisted preferences are missing or malformed", () => {
    expect(normalizeApplicationPackPreferences()).toEqual({
      language: "auto",
      tone: "professional",
    });
    expect(
      normalizeApplicationPackPreferences({
        language: 42,
        tone: "casual",
        cvTemplateId: "",
      }),
    ).toEqual({ language: "auto", tone: "professional" });
  });
});
