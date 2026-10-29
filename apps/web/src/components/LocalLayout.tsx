import { LocalCreditBalanceProvider } from "../billing/CreditBalanceProvider.js";
import AppShell from "./AppShell";

// The local edition runs for the single person using this device, so there is no session to check.
export default function LocalLayout() {
  return (
    <LocalCreditBalanceProvider>
      <AppShell />
    </LocalCreditBalanceProvider>
  );
}
