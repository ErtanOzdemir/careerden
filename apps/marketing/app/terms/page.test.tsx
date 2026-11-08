import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TermsPage from "./page";

describe("terms of service", () => {
  it("includes the AI-generated output disclaimer", () => {
    render(<TermsPage />);

    expect(screen.getByRole("heading", { name: "AI-generated output" })).toBeVisible();
    expect(
      screen.getByText(/You must check every line before you send, submit, or rely on it/),
    ).toBeVisible();
  });
});
