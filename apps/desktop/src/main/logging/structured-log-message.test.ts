import { describe, expect, it } from "vitest";
import { createStructuredLogMessage, parseStructuredLogMessage } from "./structured-log-message.js";

describe("parseStructuredLogMessage", () => {
  it("round-trips a log message, including one wrapped in a message event", () => {
    const message = createStructuredLogMessage({
      level: "error",
      event: "scrape.failed",
      fields: { statusCode: 404, category: "not_found", retry: false, traceId: null },
    });

    expect(parseStructuredLogMessage(message)).toEqual(message.entry);
    expect(parseStructuredLogMessage({ data: message, ports: [] })).toEqual(message.entry);
  });

  it("drops fields that are not primitives", () => {
    expect(
      parseStructuredLogMessage({
        type: "log",
        entry: {
          level: "info",
          event: "x",
          fields: { ok: 1, nested: { a: 1 }, list: [1], infinite: Number.POSITIVE_INFINITY },
        },
      }),
    ).toEqual({ level: "info", event: "x", fields: { ok: 1 } });
  });

  it.each([
    null,
    { type: "scrape:error" },
    { type: "log", entry: { level: "verbose", event: "x" } },
    { type: "log", entry: { level: "info" } },
  ])("rejects %j", (message) => {
    expect(parseStructuredLogMessage(message)).toBeUndefined();
  });
});
