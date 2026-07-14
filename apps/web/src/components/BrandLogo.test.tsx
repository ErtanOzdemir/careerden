import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandLogo } from "./BrandLogo.js";

describe("BrandLogo", () => {
  it("provides black and white assets for light and dark theme resolution", () => {
    render(<BrandLogo className="size-8" />);

    const [lightLogo, darkLogo] = screen.getAllByRole("img", { name: "Link2CV" });

    expect(lightLogo).toHaveClass("brand-logo-theme-light", "size-8");
    expect(lightLogo).toHaveAttribute("src", expect.stringContaining("handshake-logo.svg"));
    expect(darkLogo).toHaveClass("brand-logo-theme-dark", "size-8");
    expect(darkLogo).toHaveAttribute("src", expect.stringContaining("handshake-logo-white.svg"));
  });
});
