import { describe, expect, it } from "vitest";
import { parseLocalBackendCommand, parseLocalBackendEvent } from "./local-backend-messages.js";

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

describe("parseLocalBackendEvent", () => {
  it("keeps only the version and migration fields of a diagnostics result", () => {
    expect(
      parseLocalBackendEvent({
        type: "diagnostics:result",
        requestId: "request-1",
        database: {
          engineVersion: "PGlite (PostgreSQL 17.5)",
          lastMigration: "20261031000000_x.cjs",
          dataDir: "/Users/someone/Library/Application Support/Careerden Unplugged/data",
        },
      }),
    ).toEqual({
      type: "diagnostics:result",
      requestId: "request-1",
      database: {
        engineVersion: "PGlite (PostgreSQL 17.5)",
        lastMigration: "20261031000000_x.cjs",
      },
    });
  });

  it("rejects a diagnostics result without a database object", () => {
    expect(
      parseLocalBackendEvent({ type: "diagnostics:result", requestId: "request-1" }),
    ).toBeUndefined();
  });
});
