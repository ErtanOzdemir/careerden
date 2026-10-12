import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Billing from "./Billing";

const billingMocks = vi.hoisted(() => ({
  createCheckout: vi.fn(),
  createPortal: vi.fn(),
  listCreditActivity: vi.fn(),
  listPayments: vi.fn(),
  redirectToBillingUrl: vi.fn(),
  refresh: vi.fn(async () => undefined),
  useCreditBalance: vi.fn(),
}));

vi.mock("../api/billing.js", () => ({
  billingApi: {
    createCheckout: billingMocks.createCheckout,
    createPortal: billingMocks.createPortal,
    listCreditActivity: billingMocks.listCreditActivity,
    listPayments: billingMocks.listPayments,
  },
  redirectToBillingUrl: billingMocks.redirectToBillingUrl,
}));

vi.mock("../billing/CreditBalanceProvider.js", () => ({
  useCreditBalance: billingMocks.useCreditBalance,
}));

describe("Billing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    billingMocks.listPayments.mockResolvedValue([]);
    billingMocks.listCreditActivity.mockResolvedValue([]);
    billingMocks.useCreditBalance.mockReturnValue({
      balance: { totalCredits: 10, availableCredits: 9, reservedCredits: 1 },
      balanceError: null,
      isLoading: false,
      isLoadingSubscription: false,
      refresh: billingMocks.refresh,
      subscription: null,
      subscriptionError: null,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows available, in-progress, and total AI credits", () => {
    renderBilling();

    expect(screen.getByRole("heading", { name: "AI credits" })).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("opens Creem checkout for an account without a subscription", async () => {
    billingMocks.createCheckout.mockResolvedValue({ url: "https://checkout.creem.io/ch_123" });

    renderBilling();
    fireEvent.click(await screen.findByRole("button", { name: "Subscribe with Creem" }));

    await waitFor(() => expect(billingMocks.createCheckout).toHaveBeenCalledOnce());
    expect(billingMocks.redirectToBillingUrl).toHaveBeenCalledWith(
      "https://checkout.creem.io/ch_123",
    );
    expect(billingMocks.refresh).toHaveBeenCalledOnce();
  });

  it("keeps a zero balance visible when a background refresh reports an error", async () => {
    billingMocks.useCreditBalance.mockReturnValue({
      balance: { totalCredits: 0, availableCredits: 0, reservedCredits: 0 },
      balanceError: "Could not refresh AI credits.",
      isLoading: false,
      isLoadingSubscription: false,
      refresh: billingMocks.refresh,
      subscription: null,
      subscriptionError: null,
    });

    renderBilling();

    expect(await screen.findAllByText("0")).toHaveLength(3);
    expect(screen.getByRole("alert")).toHaveTextContent("Could not refresh AI credits.");
    expect(screen.getByRole("button", { name: "Subscribe with Creem" })).toBeEnabled();
  });

  it("shows scheduled cancellation and opens the Creem customer portal", async () => {
    billingMocks.useCreditBalance.mockReturnValue({
      balance: { totalCredits: 100, availableCredits: 100, reservedCredits: 0 },
      balanceError: null,
      isLoading: false,
      isLoadingSubscription: false,
      refresh: billingMocks.refresh,
      subscription: {
        provider: "creem",
        planKey: "pro",
        status: "active",
        currentPeriodStart: "2026-07-01T00:00:00.000Z",
        currentPeriodEnd: "2026-08-01T00:00:00.000Z",
        cancelAtPeriodEnd: true,
      },
      subscriptionError: null,
    });
    billingMocks.createPortal.mockResolvedValue({ url: "https://creem.io/portal/cust_123" });

    renderBilling();

    expect(await screen.findByText(/Cancellation is scheduled/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Manage billing" }));

    await waitFor(() => expect(billingMocks.createPortal).toHaveBeenCalledOnce());
    expect(billingMocks.redirectToBillingUrl).toHaveBeenCalledWith(
      "https://creem.io/portal/cust_123",
    );
  });

  it("lists Creem payments and local credit activity", async () => {
    billingMocks.listPayments.mockResolvedValue([
      {
        id: "tran_2",
        status: "partially_refunded",
        currency: "USD",
        amountMinor: 900,
        amountPaidMinor: 900,
        refundedAmountMinor: 400,
        periodStart: "2026-09-01T12:00:00.000Z",
        periodEnd: "2026-10-01T12:00:00.000Z",
        createdAt: "2026-09-01T12:00:00.000Z",
      },
      {
        id: "tran_1",
        status: "paid",
        currency: "USD",
        amountMinor: 900,
        createdAt: "2026-08-01T12:00:00.000Z",
      },
    ]);
    billingMocks.listCreditActivity.mockResolvedValue([
      {
        id: "ledger-3",
        kind: "analysis_usage",
        delta: -1,
        occurredAt: "2026-10-12T12:00:00.000Z",
        jobApplication: {
          id: "job-1",
          deleted: false,
          roleTitle: "Engineer",
          companyName: "Acme",
        },
      },
      {
        id: "ledger-2",
        kind: "analysis_usage",
        delta: -1,
        occurredAt: "2026-10-11T12:00:00.000Z",
        jobApplication: { id: "job-2", deleted: true },
      },
      {
        id: "ledger-1",
        kind: "free_monthly_grant",
        delta: 10,
        occurredAt: "2026-10-01T12:00:00.000Z",
      },
    ]);

    renderBilling();

    expect(await screen.findByText("Partially refunded · $4.00")).toBeInTheDocument();
    expect(screen.getByText("Paid")).toBeInTheDocument();
    expect(screen.getAllByText("$9.00")).toHaveLength(2);
    expect(await screen.findByRole("link", { name: "Engineer at Acme" })).toHaveAttribute(
      "href",
      "/applications/job-1",
    );
    expect(screen.getByText("deleted application")).toBeInTheDocument();
    expect(screen.getByText("Monthly free credits")).toBeInTheDocument();
    expect(screen.getByText("+10")).toBeInTheDocument();
    expect(screen.getAllByText("−1")).toHaveLength(2);
  });

  it("keeps credit activity visible when payment history cannot be loaded", async () => {
    billingMocks.listPayments.mockRejectedValue(new Error("Creem unavailable"));
    billingMocks.listCreditActivity.mockResolvedValue([
      {
        id: "ledger-1",
        kind: "subscription_grant",
        delta: 100,
        occurredAt: "2026-10-01T12:00:00.000Z",
      },
    ]);

    renderBilling();

    expect(
      await screen.findByText("Payment history is unavailable right now. Try again later."),
    ).toBeInTheDocument();
    expect(await screen.findByText("Subscription credits")).toBeInTheDocument();
    expect(screen.getByText("+100")).toBeInTheDocument();
  });

  it("shows empty states for new accounts", async () => {
    renderBilling();

    expect(await screen.findByText("No payments yet.")).toBeInTheDocument();
    expect(await screen.findByText("No credit activity yet.")).toBeInTheDocument();
  });
});

function renderBilling() {
  return render(
    <MemoryRouter>
      <Billing />
    </MemoryRouter>,
  );
}
