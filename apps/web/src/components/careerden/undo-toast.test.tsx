import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UndoToast, undoToastDurationMs } from "./undo-toast.js";

describe("UndoToast", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("offers to undo the change", () => {
    const onUndo = vi.fn();
    render(<UndoToast message="Status changed to Offer." onUndo={onUndo} onDismiss={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    expect(screen.getByRole("status")).toHaveTextContent("Status changed to Offer.");
    expect(onUndo).toHaveBeenCalledOnce();
  });

  it("dismisses itself after a while, but not while the undo is running", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const { rerender } = render(
      <UndoToast message="Status changed to Offer." busy onUndo={vi.fn()} onDismiss={onDismiss} />,
    );

    act(() => vi.advanceTimersByTime(undoToastDurationMs));
    expect(onDismiss).not.toHaveBeenCalled();

    rerender(
      <UndoToast message="Status changed to Offer." onUndo={vi.fn()} onDismiss={onDismiss} />,
    );
    act(() => vi.advanceTimersByTime(undoToastDurationMs));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
