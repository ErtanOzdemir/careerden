import { describe, expect, it } from "vitest";
import { AiOutputValidationError } from "../matching/ai/generate-with-output-schema.js";
import { describeErrorForLog } from "./describe-error-for-log.js";

describe("describeErrorForLog", () => {
  it("keeps the name, code, status, and a redacted message", () => {
    const error = Object.assign(new Error("Request failed: api_key=sk-abcdefghijklmnopqrstuv"), {
      code: "ECONNRESET",
      statusCode: 401,
    });

    expect(describeErrorForLog(error)).toEqual({
      errorName: "Error",
      errorCode: "ECONNRESET",
      statusCode: 401,
      errorMessage: "Request failed: api_key=[REDACTED]",
    });
  });

  it("finds a status code on a nested cause", () => {
    const cause = Object.assign(new Error("rate limited"), {
      name: "AI_APICallError",
      statusCode: 429,
    });
    const error = new Error("Retries exhausted", { cause });

    expect(describeErrorForLog(error)).toMatchObject({
      statusCode: 429,
      causeName: "AI_APICallError",
    });
  });

  it("drops messages that embed model output", () => {
    const fields = describeErrorForLog(
      new AiOutputValidationError(Object.assign(new Error("bad"), { text: "secret model text" })),
    );

    expect(fields.errorName).toBe("AiOutputValidationError");
    expect(fields).not.toHaveProperty("errorMessage");
    expect(JSON.stringify(fields)).not.toContain("secret model text");
  });

  it("describes non-error values without their contents", () => {
    expect(describeErrorForLog("profile text")).toEqual({ errorName: "NonErrorThrown" });
  });

  it("truncates long messages", () => {
    const fields = describeErrorForLog(new Error("x".repeat(1_000)));

    expect(String(fields.errorMessage).length).toBeLessThanOrEqual(303);
  });
});
