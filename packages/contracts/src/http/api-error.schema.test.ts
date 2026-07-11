import { describe, expect, it } from "vitest";
import { apiErrorResponseSchema } from "./api-error.schema.js";

describe("apiErrorResponseSchema", () => {
  it("accepts stable error fields and application-specific details", () => {
    expect(
      apiErrorResponseSchema.parse({
        code: "validation",
        error: "Unknown placeholders",
        unknown: ["missing"],
      }),
    ).toEqual({
      code: "validation",
      error: "Unknown placeholders",
      unknown: ["missing"],
    });
  });

  it("rejects unknown error codes", () => {
    expect(() =>
      apiErrorResponseSchema.parse({ code: "retry_later", error: "Unavailable" }),
    ).toThrow();
  });
});
