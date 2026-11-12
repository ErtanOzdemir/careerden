import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TermsPage from "./page";

const site = vi.hoisted(() => ({ legalPagesEnabled: true }));

vi.mock("@/lib/site", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/site")>();
  return {
    ...actual,
    get legalPagesEnabled() {
      return site.legalPagesEnabled;
    },
  };
});

describe("terms of service", () => {
  afterEach(() => {
    site.legalPagesEnabled = true;
  });

  it("includes the AI-generated output disclaimer", () => {
    render(<TermsPage />);

    expect(screen.getByRole("heading", { name: "AI-generated output" })).toBeVisible();
    expect(
      screen.getByText(/You must check every line before you send, submit, or rely on it/),
    ).toBeVisible();
  });

  it("answers not found while the legal pages are disabled", () => {
    site.legalPagesEnabled = false;

    expect(() => render(<TermsPage />)).toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });
});
