import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import logoUrl from "../public/handshake-logo.svg";
import whiteLogoUrl from "../public/handshake-logo-white.svg";
import { BrandLogo } from "./BrandLogo.js";

describe("BrandLogo", () => {
  it("provides black and white assets for light and dark theme resolution", () => {
    render(<BrandLogo className="size-8" />);

    const [lightLogo, darkLogo] = screen.getAllByRole("img", { name: "Careerden" });

    // Vite inlines these small SVGs as data URIs, so compare against the imported URLs rather
    // than file names.
    expect(logoUrl).not.toBe(whiteLogoUrl);
    expect(lightLogo).toHaveClass("brand-logo-theme-light", "size-8");
    expect(lightLogo).toHaveAttribute("src", logoUrl);
    expect(darkLogo).toHaveClass("brand-logo-theme-dark", "size-8");
    expect(darkLogo).toHaveAttribute("src", whiteLogoUrl);
  });
});
