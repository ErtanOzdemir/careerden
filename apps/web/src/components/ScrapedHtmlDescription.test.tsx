import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScrapedHtmlDescription } from "./ScrapedHtmlDescription.js";

describe("ScrapedHtmlDescription", () => {
  it("renders allowed description HTML and strips unsafe markup", () => {
    render(
      <ScrapedHtmlDescription
        html={`<h2>About the role</h2><p>Build <strong>TypeScript</strong>.</p><img src=x onerror=alert(1)><script>alert(1)</script>`}
      />,
    );

    expect(screen.getByRole("heading", { name: "About the role" })).toBeDefined();
    expect(screen.getByText("TypeScript")).toBeDefined();
    expect(screen.queryByText(/alert/)).toBeNull();
    expect(document.querySelector("script")).toBeNull();
    expect(document.querySelector("img")).toBeNull();
  });

  it("preserves safe HTTP links without event handlers", () => {
    render(
      <ScrapedHtmlDescription
        html={`<p><a href="https://example.com/team" onclick="alert(1)">Team</a></p>`}
      />,
    );

    const link = screen.getByRole("link", { name: "Team" });
    expect(link).toHaveAttribute("href", "https://example.com/team");
    expect(link).not.toHaveAttribute("onclick");
  });
});
