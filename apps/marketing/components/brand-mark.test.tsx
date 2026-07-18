import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandMark } from "./brand-mark";

describe("BrandMark", () => {
  it("uses the application logo assets for light and inverse surfaces", () => {
    const light = render(<BrandMark />);
    expect(light.container.querySelector("img")).toHaveAttribute("src", "/handshake-logo.svg");
    light.unmount();

    const inverse = render(<BrandMark inverse />);
    expect(inverse.container.querySelector("img")).toHaveAttribute(
      "src",
      "/handshake-logo-white.svg",
    );
  });
});
