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
    for (const link of screen.getAllByRole("link", { name: "Download" })) {
      expect(link).toHaveAttribute("href", "/download");
    }
    expect(screen.getByRole("link", { name: "View Link2CV on GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/ErtanOzdemir/link2cv",
    );
    expect(screen.getByRole("link", { name: "View Link2CV on GitHub" })).toHaveAttribute(
      "target",
      "_blank",
    );
    expect(container.querySelector('a[href*="/login"]')).not.toBeInTheDocument();
    expect(container.querySelector('a[href*="/signup"]')).not.toBeInTheDocument();
    expect(container.querySelector('a[href="/onboarding"]')).not.toBeInTheDocument();
  });
});
