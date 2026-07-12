import { describe, expect, it, vi } from "vitest";
import type { SupportRequestNotifier } from "@link2cv/domain";
import { SubmitSupportRequestUseCase } from "./submit-support-request.use-case.js";

describe("SubmitSupportRequestUseCase", () => {
  const input = {
    user: { id: "user-1", email: "ada@example.com", name: "Ada Lovelace" },
    reason: "bug_report" as const,
    description: "The document preview does not load.",
  };

  it("passes the authenticated user and support details to the notifier", async () => {
    const notifier: SupportRequestNotifier = { notify: vi.fn(async () => undefined) };
    const useCase = new SubmitSupportRequestUseCase(notifier);

    await expect(useCase.execute(input)).resolves.toBeUndefined();
    expect(notifier.notify).toHaveBeenCalledWith(input);
  });

  it("propagates notifier failures", async () => {
    const failure = new Error("Notifier unavailable");
    const notifier: SupportRequestNotifier = {
      notify: vi.fn(async () => {
        throw failure;
      }),
    };

    await expect(new SubmitSupportRequestUseCase(notifier).execute(input)).rejects.toBe(failure);
  });
});
