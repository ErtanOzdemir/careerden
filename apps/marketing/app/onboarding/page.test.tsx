import { describe, expect, it, vi } from "vitest";

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }));

vi.mock("next/navigation", () => ({ redirect }));

import OnboardingPage, { metadata } from "./page";

describe("legacy onboarding route", () => {
  it("redirects to the public workflow and remains excluded from indexing", () => {
    OnboardingPage();

    expect(redirect).toHaveBeenCalledWith("/#how-it-works");
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  });
});
