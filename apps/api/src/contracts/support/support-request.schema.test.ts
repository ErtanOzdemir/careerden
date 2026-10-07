import { describe, expect, it } from "vitest";
import { submitSupportRequestSchema } from "./support-request.schema.js";

describe("submitSupportRequestSchema", () => {
  it.each(["bug_report", "feature_request", "other"])("accepts the %s reason", (reason) => {
    expect(
      submitSupportRequestSchema.parse({ reason, description: "  Please help with this issue.  " }),
    ).toEqual({ reason, description: "Please help with this issue." });
  });

  it("rejects unsupported reasons and descriptions outside the length limits", () => {
    expect(
      submitSupportRequestSchema.safeParse({ reason: "billing", description: "Long enough text" })
        .success,
    ).toBe(false);
    expect(
      submitSupportRequestSchema.safeParse({ reason: "other", description: "Too short" }).success,
    ).toBe(false);
    expect(
      submitSupportRequestSchema.safeParse({ reason: "other", description: "a".repeat(5_001) })
        .success,
    ).toBe(false);
  });
});
