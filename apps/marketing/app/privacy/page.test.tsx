import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PrivacyPage from "./page";

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

describe("privacy policy", () => {
  afterEach(() => {
    site.legalPagesEnabled = true;
  });

  it("states that the desktop app keeps data on the device", () => {
    render(<PrivacyPage />);

    expect(
      screen.getByRole("heading", { name: "The desktop app keeps your data on your device" }),
    ).toBeVisible();
    expect(screen.getByText(/We cannot see, access, or recover this data/)).toBeVisible();
  });

  it("includes the Turkish KVKK notice", () => {
    render(<PrivacyPage />);

    const heading = screen.getByRole("heading", { name: "Türkiye: KVKK aydınlatma metni" });
    expect(heading).toBeVisible();
    expect(heading.nextElementSibling).toHaveAttribute("lang", "tr");
    expect(screen.getByText(/KVKK madde 11/)).toBeVisible();
  });

  it("is not labelled as a draft", () => {
    render(<PrivacyPage />);

    expect(screen.queryByText("Legal review required")).not.toBeInTheDocument();
    expect(screen.getByText("Last updated: 18 November 2026")).toBeVisible();
  });

  it("answers not found while the legal pages are disabled", () => {
    site.legalPagesEnabled = false;

    expect(() => render(<PrivacyPage />)).toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });
});
