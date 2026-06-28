import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthShell } from "./Login";

describe("AuthShell", () => {
  it("renders the split auth card with a black animated visual panel", () => {
    render(
      <AuthShell title="Welcome back" subtitle="Sign in to continue.">
        <button type="button">Continue</button>
      </AuthShell>,
    );

    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByText("Sign in to continue.")).toBeInTheDocument();
    expect(screen.getAllByText("Link2CV")).toHaveLength(2);
    expect(screen.getByTestId("auth-wave-panel")).toHaveClass(
      "bg-black",
      "dark:bg-white",
      "dark:text-black",
      "md:mt-10",
      "md:min-h-[calc(100vh-4rem)]",
      "md:rounded-l-2xl",
      "md:rounded-tl-2xl",
      "md:rounded-r-2xl",
    );
    expect(screen.getByTestId("auth-wave-brand")).toHaveClass("h-24", "items-end", "pb-4");
    expect(screen.getByTestId("auth-form-shell")).toHaveClass("[-webkit-app-region:no-drag]");
    expect(screen.getByTestId("auth-page-shell")).toHaveClass(
      "bg-background",
      "p-2",
      "[-webkit-app-region:drag]",
    );
    expect(screen.getByTestId("auth-card-shell")).toHaveClass(
      "bg-background",
      "max-w-none",
      "min-h-[calc(100vh-1rem)]",
      "rounded-none",
      "shadow-none",
    );
  });
});
