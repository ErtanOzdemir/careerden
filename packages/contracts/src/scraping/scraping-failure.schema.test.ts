import { describe, expect, it } from "vitest";
import {
  parseScrapingFailureCategory,
  scrapingFailureCategorySchema,
  scrapingFailureGuidance,
} from "./scraping-failure.schema.js";

describe("scraping failure categories", () => {
  it("gives every category a message and at least one recovery action", () => {
    for (const category of scrapingFailureCategorySchema.options) {
      const guidance = scrapingFailureGuidance[category];

      expect(guidance.message).not.toHaveLength(0);
      expect(guidance.actions.length).toBeGreaterThan(0);
    }
  });

  it("only offers pasting the text for a removed posting", () => {
    expect(scrapingFailureGuidance.not_found.actions).toEqual(["paste_text"]);
  });

  it("parses known categories and ignores unknown values", () => {
    expect(parseScrapingFailureCategory("rate_limited")).toBe("rate_limited");
    expect(parseScrapingFailureCategory("teapot")).toBeUndefined();
    expect(parseScrapingFailureCategory(undefined)).toBeUndefined();
  });
});
