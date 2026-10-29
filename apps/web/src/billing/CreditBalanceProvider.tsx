import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { billingApi } from "../api/billing.js";
import type { ApiBillingSubscription, ApiCreditBalance } from "../api/billing.js";

const reservedCreditPollIntervalMs = 3_000;

interface CreditBalanceContextValue {
  balance: ApiCreditBalance | null;
  balanceError: string | null;
  isLoading: boolean;
  isLoadingSubscription: boolean;
  refresh: () => Promise<void>;
  refreshBalance: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
  subscription: ApiBillingSubscription | null;
  subscriptionError: string | null;
}

const CreditBalanceContext = createContext<CreditBalanceContextValue | undefined>(undefined);

export function CreditBalanceProvider({ children }: { children: ReactNode }) {
  const [balance, setBalance] = useState<ApiCreditBalance | null>(null);
  const [subscription, setSubscription] = useState<ApiBillingSubscription | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const [hasLoadedSubscription, setHasLoadedSubscription] = useState(false);
  const balanceRequest = useRef<Promise<void> | null>(null);
  const subscriptionRequest = useRef<Promise<void> | null>(null);

  const refreshBalance = useCallback((): Promise<void> => {
    if (balanceRequest.current) return balanceRequest.current;

    const request = billingApi
      .getCredits()
      .then((nextBalance) => {
        setBalance(nextBalance);
        setBalanceError(null);
      })
      .catch((error: unknown) => {
        setBalanceError(error instanceof Error ? error.message : "Could not refresh AI credits.");
      })
      .finally(() => {
        balanceRequest.current = null;
      });
    balanceRequest.current = request;
    return request;
  }, []);

  const refreshSubscription = useCallback((): Promise<void> => {
    if (subscriptionRequest.current) return subscriptionRequest.current;

    const request = billingApi
      .getSubscription()
      .then((nextSubscription) => {
        setSubscription(nextSubscription);
        setSubscriptionError(null);
      })
      .catch((error: unknown) => {
        setSubscriptionError(
          error instanceof Error ? error.message : "Could not refresh subscription.",
        );
      })
      .finally(() => {
        setHasLoadedSubscription(true);
        subscriptionRequest.current = null;
      });
    subscriptionRequest.current = request;
    return request;
  }, []);

  const refresh = useCallback(
    async function refreshBilling(): Promise<void> {
      await Promise.all([refreshBalance(), refreshSubscription()]);
    },
    [refreshBalance, refreshSubscription],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    function refreshOnFocus() {
      void refresh();
    }

    window.addEventListener("focus", refreshOnFocus);
    return () => window.removeEventListener("focus", refreshOnFocus);
  }, [refresh]);

  useEffect(() => {
    if (!balance?.reservedCredits) return;

    const interval = window.setInterval(() => {
      void refreshBalance();
    }, reservedCreditPollIntervalMs);
    return () => window.clearInterval(interval);
  }, [balance?.reservedCredits, refreshBalance]);

  const value = useMemo<CreditBalanceContextValue>(
    () => ({
      balance,
      balanceError,
      isLoading: balance === null && balanceError === null,
      isLoadingSubscription: !hasLoadedSubscription,
      refresh,
      refreshBalance,
      refreshSubscription,
      subscription,
      subscriptionError,
    }),
    [
      balance,
      balanceError,
      hasLoadedSubscription,
      refresh,
      refreshBalance,
      refreshSubscription,
      subscription,
      subscriptionError,
    ],
  );

  return <CreditBalanceContext.Provider value={value}>{children}</CreditBalanceContext.Provider>;
}

const localCreditBalance: CreditBalanceContextValue = {
  balance: null,
  balanceError: null,
  isLoading: false,
  isLoadingSubscription: false,
  refresh: async () => undefined,
  refreshBalance: async () => undefined,
  refreshSubscription: async () => undefined,
  subscription: null,
  subscriptionError: null,
};

// The local edition has no credits; consumers keep calling refresh without reaching billing.
export function LocalCreditBalanceProvider({ children }: { children: ReactNode }) {
  return (
    <CreditBalanceContext.Provider value={localCreditBalance}>
      {children}
    </CreditBalanceContext.Provider>
  );
}

export function useCreditBalance(): CreditBalanceContextValue {
  const value = useContext(CreditBalanceContext);
  if (!value) {
    throw new Error("useCreditBalance must be used within CreditBalanceProvider");
  }
  return value;
}
