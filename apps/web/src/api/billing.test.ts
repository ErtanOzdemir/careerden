import { beforeEach, describe, expect, it, vi } from "vitest";

const clientMocks = vi.hoisted(() => ({
  requestJson: vi.fn(),
}));

vi.mock("./client.js", () => clientMocks);

import { billingApi, redirectToBillingUrl } from "./billing.js";

describe("billingApi", () => {
  beforeEach(() => {
    clientMocks.requestJson.mockReset();
    delete window.electronAPI;
  });

  it("uses authenticated billing endpoints without caller-provided identity", async () => {
    clientMocks.requestJson
      .mockResolvedValueOnce({ totalCredits: 10, availableCredits: 9, reservedCredits: 1 })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ url: "https://checkout.creem.io/ch_123" })
      .mockResolvedValueOnce({ url: "https://creem.io/portal/cust_123" });

    await billingApi.getCredits();
    await billingApi.getSubscription();
    await billingApi.createCheckout();
    await billingApi.createPortal();

    expect(clientMocks.requestJson.mock.calls).toEqual([
      ["/billing/credits"],
      ["/billing/subscription"],
      ["/billing/checkout", { method: "POST" }],
      ["/billing/portal", { method: "POST" }],
    ]);
  });

  it("opens hosted billing in the system browser inside Electron", async () => {
    const openExternal = vi.fn(async () => undefined);
    window.electronAPI = { openExternal } as Window["electronAPI"];

    await redirectToBillingUrl("https://creem.io/test/checkout_123");

    expect(openExternal).toHaveBeenCalledWith("https://creem.io/test/checkout_123");
  });
});
