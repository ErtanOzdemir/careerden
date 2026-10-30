import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Topbar } from "./Topbar";

vi.mock("../edition.js", () => ({ isLocalEdition: true }));
vi.mock("../billing/CreditBalanceProvider.js", () => ({
  useCreditBalance: () => ({ balance: null, balanceError: null, isLoading: false }),
}));

describe("Topbar in the local edition", () => {
  afterEach(cleanup);

  it("shows no AI credit badge", () => {
    render(
      <MemoryRouter>
        <Topbar title="Dashboard" onAddJob={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link", { name: "AI credits" })).not.toBeInTheDocument();
  });
});
