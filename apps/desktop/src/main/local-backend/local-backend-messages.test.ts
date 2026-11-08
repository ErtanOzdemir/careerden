import { describe, expect, it } from "vitest";
import { parseLocalBackendCommand } from "./local-backend-messages.js";

describe("parseLocalBackendCommand", () => {
  it("accepts an AI selection with the catalog's models", () => {
    const command = {
      type: "ai-selection:result",
      requestId: "request-1",
      selection: {
        provider: "openai",
        apiKey: "key",
        models: { recommended: "gpt-4.1-mini", fallbacks: ["gpt-4o-mini"] },
      },
    };

    expect(parseLocalBackendCommand(command)).toEqual(command);
  });

  it("rejects an AI selection with malformed models", () => {
    expect(
      parseLocalBackendCommand({
        type: "ai-selection:result",
        requestId: "request-1",
        selection: { provider: "openai", apiKey: "key", models: { fallbacks: "gpt-4o-mini" } },
      }),
    ).toBeUndefined();
  });
});
