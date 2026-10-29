import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const edition = vi.hoisted(() => ({ local: false }));
vi.mock("./edition.js", () => ({
  get isLocalEdition() {
    return edition.local;
  },
}));
vi.mock("./components/AppShell", () => ({
  default: () => (
    <div data-testid="app-shell">
      <Outlet />
    </div>
  ),
}));
vi.mock("./components/AuthenticatedLayout", () => ({
  default: () => (
    <div data-testid="authenticated-layout">
      <Outlet />
    </div>
  ),
}));
vi.mock("./desktop-updates/DesktopUpdateProvider.js", () => ({
  DesktopUpdateProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("./desktop-updates/DesktopUpdateGate.js", () => ({ DesktopUpdateGate: () => null }));
vi.mock("./pages/Dashboard", () => ({ default: () => <p>Dashboard page</p> }));
vi.mock("./pages/ApplicationsLog", () => ({ default: () => <p>ApplicationsLog page</p> }));
vi.mock("./pages/AppDetail", () => ({ default: () => <p>AppDetail page</p> }));
vi.mock("./pages/ProfileManager", () => ({ default: () => <p>ProfileManager page</p> }));
vi.mock("./pages/Login", () => ({ default: () => <p>Login page</p> }));
vi.mock("./pages/Signup", () => ({ default: () => <p>Signup page</p> }));
vi.mock("./pages/Settings", () => ({ default: () => <p>Settings page</p> }));
vi.mock("./pages/Billing", () => ({ default: () => <p>Billing page</p> }));
vi.mock("./pages/Support", () => ({ default: () => <p>Support page</p> }));
vi.mock("./pages/ForgotPassword", () => ({ default: () => <p>ForgotPassword page</p> }));
vi.mock("./pages/ResetPassword", () => ({ default: () => <p>ResetPassword page</p> }));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("App routes by edition", () => {
  afterEach(cleanup);

  it("keeps sign-in, billing, and support routes in the cloud edition", () => {
    edition.local = false;

    for (const [path, page] of [
      ["/login", "Login page"],
      ["/billing", "Billing page"],
      ["/support", "Support page"],
    ]) {
      renderAt(path!);
      expect(screen.getByText(page!)).toBeInTheDocument();
      cleanup();
    }
    renderAt("/");
    expect(screen.getByTestId("authenticated-layout")).toBeInTheDocument();
  });

  it("opens the workspace without a session check in the local edition", () => {
    edition.local = true;

    renderAt("/");

    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    expect(screen.getByText("Dashboard page")).toBeInTheDocument();
    expect(screen.queryByTestId("authenticated-layout")).not.toBeInTheDocument();
  });

  it("sends account, billing, and support paths home in the local edition", () => {
    edition.local = true;

    for (const path of ["/login", "/signup", "/billing", "/support", "/reset-password"]) {
      renderAt(path);
      expect(screen.getByText("Dashboard page")).toBeInTheDocument();
      cleanup();
    }
    renderAt("/settings");
    expect(screen.getByText("Settings page")).toBeInTheDocument();
  });
});
