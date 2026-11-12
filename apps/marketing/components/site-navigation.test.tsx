import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

describe("marketing navigation", () => {
  it("uses landing anchors without exposing web-app authentication links", () => {
    const { container } = render(
      <>
        <SiteHeader />
        <SiteFooter />
      </>,
    );

    for (const link of screen.getAllByRole("link", { name: "How it works" })) {
      expect(link).toHaveAttribute("href", "/#how-it-works");
    }
    for (const link of screen.getAllByRole("link", { name: "Job application tracker" })) {
      expect(link).toHaveAttribute("href", "/#application-tracking");
    }
    for (const link of screen.getAllByRole("link", { name: "Application pack" })) {
      expect(link).toHaveAttribute("href", "/#application-pack");
    }
    for (const link of screen.getAllByRole("link", { name: "Unplugged" })) {
      expect(link).toHaveAttribute("href", "/#unplugged");
    }
    for (const link of screen.getAllByRole("link", { name: "Pricing" })) {
      expect(link).toHaveAttribute("href", "/#pricing");
    }
    for (const link of screen.getAllByRole("link", { name: "Download" })) {
      expect(link).toHaveAttribute("href", "/download");
    }
    // The legal drafts stay unlinked until legalPagesEnabled is turned on.
    expect(screen.queryByRole("navigation", { name: "Legal links" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Careerden on GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/ErtanOzdemir/careerden",
    );
    expect(screen.getByRole("link", { name: "View Careerden on GitHub" })).toHaveAttribute(
      "target",
      "_blank",
    );
    const primaryNavigation = screen.getByRole("navigation", { name: "Primary navigation" });
    expect([...primaryNavigation.querySelectorAll("a")].map((link) => link.textContent)).toEqual([
      "Features",
      "How it works",
      "Pricing",
    ]);
    expect(container.querySelector(".header-download")).toHaveAttribute("href", "/download");
    expect(container.querySelector('a[href*="/login"]')).not.toBeInTheDocument();
    expect(container.querySelector('a[href*="/signup"]')).not.toBeInTheDocument();
    expect(container.querySelector('a[href="/onboarding"]')).not.toBeInTheDocument();
  });
});
