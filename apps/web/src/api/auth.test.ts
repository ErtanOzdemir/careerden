import { describe, expect, it } from "vitest";
import { resolveAuthBaseUrl } from "./auth";

describe("resolveAuthBaseUrl", () => {
  it("appends the auth path to the API base url", () => {
    expect(resolveAuthBaseUrl("/api", "http://localhost:5173")).toBe(
      "http://localhost:5173/api/auth",
    );
  });

  it("appends the auth path to an absolute api url", () => {
    expect(resolveAuthBaseUrl("http://localhost:3000")).toBe("http://localhost:3000/auth");
  });
});
