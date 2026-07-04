import { describe, expect, it } from "vitest";
import { createProfileSchema, updateProfileSchema } from "./profile.schema.js";

describe("profile schemas", () => {
  it("defaults auto-run match analysis on for new profiles", () => {
    const result = createProfileSchema.parse({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
    });

    expect(result.autoRunMatchAnalysis).toBe(true);
  });

  it("accepts auto-run match analysis updates", () => {
    const result = updateProfileSchema.parse({
      autoRunMatchAnalysis: false,
    });

    expect(result.autoRunMatchAnalysis).toBe(false);
  });
});
