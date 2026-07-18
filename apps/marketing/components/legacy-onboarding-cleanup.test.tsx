import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LegacyOnboardingCleanup } from "./legacy-onboarding-cleanup";

describe("LegacyOnboardingCleanup", () => {
  it("removes the retired onboarding value", async () => {
    const removeItem = vi.fn();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: { removeItem },
    });

    render(<LegacyOnboardingCleanup />);

    await waitFor(() => expect(removeItem).toHaveBeenCalledWith("link2cv-marketing-onboarding-v1"));
  });

  it("silently ignores blocked browser storage", async () => {
    const removeItem = vi.fn(() => {
      throw new DOMException("Storage is unavailable", "SecurityError");
    });
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: { removeItem },
    });

    expect(() => render(<LegacyOnboardingCleanup />)).not.toThrow();

    await waitFor(() => expect(removeItem).toHaveBeenCalledOnce());
  });
});
