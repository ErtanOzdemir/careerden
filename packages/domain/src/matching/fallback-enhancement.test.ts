import { describe, expect, it } from "vitest";
import { compressToProse } from "./fallback-enhancement.js";

describe("compressToProse", () => {
  it("flattens bullet markers into prose", () => {
    expect(compressToProse("- Built TypeScript services\n• Worked with product partners")).toBe(
      "Built TypeScript services. Worked with product partners.",
    );
  });

  it("keeps only the leading sentences", () => {
    expect(compressToProse("One. Two. Three. Four. Five.")).toBe("One. Two.");
  });

  it("normalizes stray whitespace", () => {
    expect(compressToProse("Built    TypeScript\t services")).toBe("Built TypeScript services.");
  });

  it("returns empty for empty input", () => {
    expect(compressToProse("   \n  ")).toBe("");
  });
});
