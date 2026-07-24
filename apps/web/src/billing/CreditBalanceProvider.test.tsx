import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { billingApi } from "../api/billing.js";
import { CreditBalanceProvider, useCreditBalance } from "./CreditBalanceProvider.js";

describe("CreditBalanceProvider", () => {
  beforeEach(() => {
    vi.spyOn(billingApi, "getSubscription").mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("coalesces concurrent balance refreshes", async () => {
    let resolveBalance!: (value: {
      totalCredits: number;
      availableCredits: number;
      reservedCredits: number;
    }) => void;
    const getCredits = vi.spyOn(billingApi, "getCredits").mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveBalance = resolve;
        }),
    );

    renderProvider();
    fireEvent.click(screen.getByRole("button", { name: "Refresh twice" }));

    expect(getCredits).toHaveBeenCalledOnce();

    resolveBalance({ totalCredits: 10, availableCredits: 10, reservedCredits: 0 });
    expect(await screen.findByText("10 available")).toBeInTheDocument();
  });

  it("refreshes on focus while preserving the last successful balance after a failure", async () => {
    const getCredits = vi
      .spyOn(billingApi, "getCredits")
      .mockResolvedValueOnce({ totalCredits: 10, availableCredits: 9, reservedCredits: 1 })
      .mockRejectedValueOnce(new Error("offline"));

    renderProvider();
    expect(await screen.findByText("9 available")).toBeInTheDocument();

    window.dispatchEvent(new Event("focus"));

    await waitFor(() => expect(getCredits).toHaveBeenCalledTimes(2));
    expect(screen.getByText("9 available")).toBeInTheDocument();
    expect(await screen.findByText("offline")).toBeInTheDocument();
  });

  it("polls while credits are reserved and stops after settlement", async () => {
    vi.useFakeTimers();
    const getCredits = vi
      .spyOn(billingApi, "getCredits")
      .mockResolvedValueOnce({ totalCredits: 10, availableCredits: 9, reservedCredits: 1 })
      .mockResolvedValueOnce({ totalCredits: 9, availableCredits: 9, reservedCredits: 0 });

    renderProvider();
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText("9 available")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    expect(getCredits).toHaveBeenCalledTimes(2);
    expect(screen.getByText("0 reserved")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6_000);
    });
    expect(getCredits).toHaveBeenCalledTimes(2);
  });
});

function renderProvider() {
  return render(
    <CreditBalanceProvider>
      <CreditBalanceProbe />
    </CreditBalanceProvider>,
  );
}

function CreditBalanceProbe() {
  const { balance, balanceError, refreshBalance } = useCreditBalance();
  return (
    <div>
      <p>{balance ? `${balance.availableCredits} available` : "Loading"}</p>
      <p>{balance ? `${balance.reservedCredits} reserved` : ""}</p>
      {balanceError ? <p>{balanceError}</p> : null}
      <button
        type="button"
        onClick={() => {
          void refreshBalance();
          void refreshBalance();
        }}
      >
        Refresh twice
      </button>
    </div>
  );
}
