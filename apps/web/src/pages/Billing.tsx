import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button.js";
import { Panel } from "../components/careerden/panel.js";
import {
  billingApi,
  redirectToBillingUrl,
  type ApiBillingPayment,
  type ApiBillingPaymentStatus,
  type ApiCreditActivity,
} from "../api/billing.js";
import { useCreditBalance } from "../billing/CreditBalanceProvider.js";
import { cn } from "../lib/utils.js";
import { CreditCard, History, Receipt } from "lucide-react";

type LoadState<T> = { status: "loading" } | { status: "loaded"; items: T[] } | { status: "error" };

export default function Billing() {
  const {
    balance,
    balanceError,
    isLoading: isLoadingBalance,
    isLoadingSubscription,
    refresh,
    subscription,
    subscriptionError,
  } = useCreditBalance();
  const [billingAction, setBillingAction] = useState<"checkout" | "portal" | null>(null);
  const [billingActionError, setBillingActionError] = useState<string | null>(null);
  const [payments, setPayments] = useState<LoadState<ApiBillingPayment>>({ status: "loading" });
  const [creditActivity, setCreditActivity] = useState<LoadState<ApiCreditActivity>>({
    status: "loading",
  });

  useEffect(() => {
    let isMounted = true;

    // Loaded independently so a Creem outage never hides the locally stored credit activity.
    billingApi
      .listPayments()
      .then((items) => isMounted && setPayments({ status: "loaded", items }))
      .catch(() => isMounted && setPayments({ status: "error" }));
    billingApi
      .listCreditActivity()
      .then((items) => isMounted && setCreditActivity({ status: "loaded", items }))
      .catch(() => isMounted && setCreditActivity({ status: "error" }));

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleBillingAction(action: "checkout" | "portal") {
    setBillingAction(action);
    setBillingActionError(null);

    try {
      const { url } =
        action === "checkout" ? await billingApi.createCheckout() : await billingApi.createPortal();
      await redirectToBillingUrl(url);
    } catch (error) {
      setBillingActionError(
        error instanceof Error ? error.message : "Could not open Creem billing.",
      );
    } finally {
      setBillingAction(null);
      void refresh();
    }
  }

  return (
    <div className="space-y-6">
      <Panel>
        <div className="flex items-center gap-2.5 px-5 py-4">
          <CreditCard className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">AI credits</h2>
        </div>
        <div className="space-y-5 border-t border-border px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <CreditMetric
              label="Available"
              value={isLoadingBalance ? "…" : String(balance?.availableCredits ?? "—")}
            />
            <CreditMetric
              label="In progress"
              value={isLoadingBalance ? "…" : String(balance?.reservedCredits ?? "—")}
            />
            <CreditMetric
              label="Total"
              value={isLoadingBalance ? "…" : String(balance?.totalCredits ?? "—")}
            />
          </div>

          <div className="space-y-1 text-sm text-muted-foreground">
            <p>Every account receives 10 free credits at the start of each UTC month.</p>
            <p>Each AI match analysis reserves one credit while it runs.</p>
            <p>
              A successful analysis uses the reservation. Failed, superseded, deleted, or timed-out
              work releases it.
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                {isLoadingSubscription
                  ? "Loading Creem billing…"
                  : subscription
                    ? getSubscriptionTitle(subscription.status)
                    : "Free credits"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {isLoadingSubscription
                  ? "Checking your current subscription."
                  : subscription
                    ? getSubscriptionDescription(subscription)
                    : "Subscribe through Creem to add 100 credits for each confirmed paid period."}
              </p>
            </div>
            <Button
              className="shrink-0"
              disabled={billingAction !== null || isLoadingSubscription}
              onClick={() => void handleBillingAction(subscription ? "portal" : "checkout")}
              size="sm"
              variant={subscription ? "outline" : "default"}
            >
              {isLoadingSubscription
                ? "Loading…"
                : billingAction
                  ? "Opening…"
                  : subscription
                    ? "Manage billing"
                    : "Subscribe with Creem"}
            </Button>
          </div>

          {(balanceError || subscriptionError || billingActionError) && (
            <p role="alert" className="text-sm text-destructive">
              {billingActionError ?? balanceError ?? subscriptionError}
            </p>
          )}
        </div>
      </Panel>

      <Panel>
        <div className="flex items-center gap-2.5 px-5 py-4">
          <Receipt className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Payment history</h2>
        </div>
        <div className="border-t border-border">
          {payments.status === "loading" ? (
            <HistoryMessage>Loading payments…</HistoryMessage>
          ) : payments.status === "error" ? (
            <HistoryMessage tone="error">
              Payment history is unavailable right now. Try again later.
            </HistoryMessage>
          ) : payments.items.length === 0 ? (
            <HistoryMessage>No payments yet.</HistoryMessage>
          ) : (
            <ul className="divide-y divide-border">
              {payments.items.map((payment) => (
                <li
                  className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
                  key={payment.id}
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {formatMoney(
                        payment.amountPaidMinor ?? payment.amountMinor,
                        payment.currency,
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(payment.createdAt)}
                      {payment.periodStart && payment.periodEnd
                        ? ` · Covers ${formatDate(payment.periodStart)} – ${formatDate(payment.periodEnd)}`
                        : ""}
                    </p>
                  </div>
                  <PaymentStatusBadge payment={payment} />
                </li>
              ))}
            </ul>
          )}
          {subscription && (
            <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
              Invoices and receipts are available through Manage billing.
            </p>
          )}
        </div>
      </Panel>

      <Panel>
        <div className="flex items-center gap-2.5 px-5 py-4">
          <History className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Credit activity</h2>
        </div>
        <div className="border-t border-border">
          {creditActivity.status === "loading" ? (
            <HistoryMessage>Loading credit activity…</HistoryMessage>
          ) : creditActivity.status === "error" ? (
            <HistoryMessage tone="error">Could not load credit activity.</HistoryMessage>
          ) : creditActivity.items.length === 0 ? (
            <HistoryMessage>No credit activity yet.</HistoryMessage>
          ) : (
            <ul className="divide-y divide-border">
              {creditActivity.items.map((entry) => (
                <li className="flex items-center justify-between gap-4 px-5 py-3" key={entry.id}>
                  <div className="min-w-0">
                    <CreditActivityLabel entry={entry} />
                    <p className="text-xs text-muted-foreground">{formatDate(entry.occurredAt)}</p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-sm font-semibold tabular-nums",
                      entry.delta > 0 ? "text-success" : "text-foreground",
                    )}
                  >
                    {entry.delta > 0 ? `+${entry.delta}` : `−${Math.abs(entry.delta)}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>
    </div>
  );
}

function HistoryMessage({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "error";
}) {
  return (
    <p
      className={cn(
        "px-5 py-4 text-sm",
        tone === "error" ? "text-destructive" : "text-muted-foreground",
      )}
      role={tone === "error" ? "alert" : undefined}
    >
      {children}
    </p>
  );
}

const paymentStatusLabels: Record<ApiBillingPaymentStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
  charged_back: "Charged back",
  failed: "Failed",
  canceled: "Canceled",
};

function PaymentStatusBadge({ payment }: { payment: ApiBillingPayment }) {
  const { status } = payment;
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-medium",
        status === "paid" && "bg-success-soft text-success",
        (status === "refunded" || status === "partially_refunded" || status === "pending") &&
          "bg-info-soft text-info",
        (status === "failed" || status === "charged_back") && "bg-danger-soft text-destructive",
        status === "canceled" && "bg-muted text-muted-foreground",
      )}
    >
      {paymentStatusLabels[status]}
      {status === "partially_refunded" && payment.refundedAmountMinor
        ? ` · ${formatMoney(payment.refundedAmountMinor, payment.currency)}`
        : ""}
    </span>
  );
}

function CreditActivityLabel({ entry }: { entry: ApiCreditActivity }) {
  if (entry.kind === "free_monthly_grant") {
    return <p className="text-sm font-medium text-foreground">Monthly free credits</p>;
  }
  if (entry.kind === "subscription_grant") {
    return <p className="text-sm font-medium text-foreground">Subscription credits</p>;
  }

  const application = entry.jobApplication;
  const title =
    [application?.roleTitle, application?.companyName].filter(Boolean).join(" at ") ||
    "Untitled application";
  return (
    <p className="truncate text-sm font-medium text-foreground">
      AI analysis ·{" "}
      {application && !application.deleted ? (
        <Link className="hover:underline" to={`/applications/${application.id}`}>
          {title}
        </Link>
      ) : (
        <span className="text-muted-foreground">deleted application</span>
      )}
    </p>
  );
}

function formatMoney(amountMinor: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(
      amountMinor / 100,
    );
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${currency}`;
  }
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString();
}

function CreditMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function getSubscriptionTitle(status: "active" | "past_due" | "canceled" | "expired"): string {
  switch (status) {
    case "active":
      return "Creem subscription active";
    case "past_due":
      return "Creem payment needs attention";
    case "canceled":
      return "Creem subscription canceled";
    case "expired":
      return "Creem subscription expired";
  }
}

function getSubscriptionDescription(subscription: {
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string;
  status: "active" | "past_due" | "canceled" | "expired";
}): string {
  const periodEnd = new Date(subscription.currentPeriodEnd);
  const formattedPeriodEnd = Number.isNaN(periodEnd.getTime())
    ? "the paid period end"
    : periodEnd.toLocaleDateString();

  if (subscription.cancelAtPeriodEnd) {
    return `Cancellation is scheduled. Paid-period credits remain valid through ${formattedPeriodEnd}.`;
  }
  if (subscription.status === "canceled" || subscription.status === "expired") {
    return `Unused paid-period credits remain valid until ${formattedPeriodEnd}.`;
  }
  if (subscription.status === "past_due") {
    return `Manage payment details in Creem. Existing paid-period credits remain valid through ${formattedPeriodEnd}.`;
  }
  return `The current paid period runs through ${formattedPeriodEnd}.`;
}
