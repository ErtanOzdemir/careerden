import { describe, expect, it } from "vitest";
import { normalizeApiBaseUrl, resolveApiBaseUrl } from "./config";

describe("API configuration", () => {
  it("ignores page query parameters when resolving the API destination", () => {
    window.history.replaceState(
      {},
      "",
      "/login?apiBaseUrl=https://capture.attacker.example&apiPort=4444",
    );

    expect(resolveApiBaseUrl("/api")).toBe("/api");
  });

  it("normalizes trusted relative and absolute API destinations", () => {
    expect(normalizeApiBaseUrl("/api/")).toBe("/api");
    expect(normalizeApiBaseUrl("https://api.example.com/base/")).toBe(
      "https://api.example.com/base",
    );
  });

  it.each([
    "javascript:alert(1)",
    "//capture.attacker.example/api",
    "https://user:password@api.example.com",
    "https://api.example.com?target=other",
    "https://api.example.com/#fragment",
    "relative/api",
  ])("rejects an unsafe configured API destination: %s", (value) => {
    expect(() => normalizeApiBaseUrl(value)).toThrow();
  });
});
