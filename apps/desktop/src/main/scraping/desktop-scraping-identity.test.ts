import { describe, expect, it } from "vitest";
import { getDesktopScrapingClaimOwner } from "./desktop-scraping-identity.js";

describe("getDesktopScrapingClaimOwner", () => {
  it("creates a runtime claim owner without requiring persisted desktop state", () => {
    const first = getDesktopScrapingClaimOwner();
    const second = getDesktopScrapingClaimOwner();

    expect(first.startsWith("desktop:")).toBe(true);
    expect(second.startsWith("desktop:")).toBe(true);
    expect(second).not.toBe(first);
  });
});
