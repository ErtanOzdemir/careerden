import { describe, expect, it } from "vitest";
import { MockSupportRequestNotifier } from "./mock-support-request.notifier.js";

describe("MockSupportRequestNotifier", () => {
  it("accepts a support request without external side effects", async () => {
    const notifier = new MockSupportRequestNotifier();

    await expect(
      notifier.notify({
        user: { id: "user-1", email: "ada@example.com", name: "Ada Lovelace" },
        reason: "other",
        description: "I need help with my workspace.",
      }),
    ).resolves.toBeUndefined();
  });
});
