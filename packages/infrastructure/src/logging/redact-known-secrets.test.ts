import { describe, expect, it } from "vitest";
import { redactKnownSecrets } from "./redact-known-secrets.js";

describe("redactKnownSecrets", () => {
  const secret = "live-key-0123456789abcdefghij";

  it("removes whole secrets and long fragments of them", () => {
    const text = `Invalid key ${secret}; key ending ${secret.slice(-10)}; key starting ${secret.slice(0, 12)}`;

    const redacted = redactKnownSecrets(text, [secret]);

    expect(redacted).not.toContain(secret.slice(-10));
    expect(redacted).not.toContain(secret.slice(0, 12));
    expect(redacted).toContain("[REDACTED]");
  });

  it("removes short secrets whole without matching their fragments", () => {
    expect(redactKnownSecrets("abc def ab", ["abc", ""])).toBe("[REDACTED] def ab");
  });
});
