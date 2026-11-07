import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScrapeFailureNotice } from "./ScrapeFailureNotice";

describe("ScrapeFailureNotice", () => {
  afterEach(cleanup);

  it("explains a removed posting and only offers pasting the text", () => {
    const onPasteText = vi.fn();
    render(
      <ScrapeFailureNotice category="not_found" onPasteText={onPasteText} onRetry={vi.fn()} />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("This posting is no longer live.");
    expect(screen.queryByRole("button", { name: /Try again/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Paste text/ }));
    expect(onPasteText).toHaveBeenCalledOnce();
  });

  it("offers both actions when LinkedIn rate-limits the import", () => {
    const onRetry = vi.fn();
    render(<ScrapeFailureNotice category="rate_limited" onPasteText={vi.fn()} onRetry={onRetry} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "LinkedIn received too many requests. Try again in a few minutes or paste the text manually.",
    );
    expect(screen.getByRole("button", { name: /Paste text/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("only offers trying again for a network failure", () => {
    render(<ScrapeFailureNotice category="network" onPasteText={vi.fn()} onRetry={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Check your internet connection.");
    expect(screen.queryByRole("button", { name: /Paste text/ })).not.toBeInTheDocument();
  });

  it("shows the message without actions on a read-only application", () => {
    render(
      <ScrapeFailureNotice category="blocked" onPasteText={vi.fn()} onRetry={vi.fn()} readOnly />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("LinkedIn is limiting access right now.");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
