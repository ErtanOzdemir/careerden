import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AiProviderFailureDto } from "@careerden/contracts";
import { ProcessingFailureBanner } from "./ProcessingFailureBanner";

function renderBanner(
  props: { aiFailure?: AiProviderFailureDto; reason?: string; local?: boolean } = {},
) {
  const onRetry = vi.fn();
  render(
    <MemoryRouter>
      <ProcessingFailureBanner canRetry isRetrying={false} onRetry={onRetry} {...props} />
    </MemoryRouter>,
  );
  return { onRetry };
}

describe("ProcessingFailureBanner", () => {
  afterEach(cleanup);

  it("explains a rejected key and offers Settings and another try", () => {
    const { onRetry } = renderBanner({
      aiFailure: { category: "invalid_api_key", provider: "openai", statusCode: 401 },
      reason: "Your API key is invalid or revoked. Update it in Settings.",
      local: true,
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Your API key was rejected");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Your API key is invalid or revoked. Update it in Settings.",
    );
    expect(screen.getByRole("link", { name: "Go to Settings" })).toHaveAttribute(
      "href",
      "/ai-provider",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("offers only another try when waiting fixes the problem", () => {
    renderBanner({ aiFailure: { category: "rate_limited", provider: "gemini" }, local: true });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "The provider is temporarily limiting requests. Try again in a few minutes.",
    );
    expect(screen.queryByRole("link", { name: "Go to Settings" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("does not send cloud users to key settings they do not have", () => {
    renderBanner({ aiFailure: { category: "invalid_api_key" }, local: false });

    expect(screen.getByRole("alert")).not.toHaveTextContent(/API key/);
    expect(screen.queryByRole("link", { name: "Go to Settings" })).not.toBeInTheDocument();
  });

  it("falls back to the stored reason for failures outside the AI provider", () => {
    renderBanner({ reason: "Scraping failed after 3 attempts" });

    expect(screen.getByRole("alert")).toHaveTextContent("Scraping failed after 3 attempts");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
