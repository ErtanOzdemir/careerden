import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProductPreview } from "./product-preview";

describe("dashboard product preview", () => {
  it("uses fictional application data and locally served company logos", () => {
    const { container } = render(<ProductPreview />);

    expect(
      screen.getByRole("img", {
        name: "Fictional Careerden job application tracking dashboard preview",
      }),
    ).toBeVisible();
    expect(screen.getByText("Fictional data · Application tracking dashboard")).toBeVisible();
    expect(screen.getByText("Google · Remote")).toBeVisible();
    expect(screen.getByText("Microsoft · Amsterdam")).toBeVisible();
    expect(screen.getByText("Spotify · Stockholm")).toBeVisible();
    expect(container.querySelector('img[src="/company-logos/google.svg"]')).toBeInTheDocument();
  });
});
