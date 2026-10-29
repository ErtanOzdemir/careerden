import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AuthenticatedLayout from "./components/AuthenticatedLayout";
import LocalLayout from "./components/LocalLayout";
import Dashboard from "./pages/Dashboard";
import ApplicationsLog from "./pages/ApplicationsLog";
import AppDetail from "./pages/AppDetail";
import ProfileManager from "./pages/ProfileManager";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Settings from "./pages/Settings";
import Billing from "./pages/Billing";
import Support from "./pages/Support";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import { DesktopUpdateGate } from "./desktop-updates/DesktopUpdateGate.js";
import { DesktopUpdateProvider } from "./desktop-updates/DesktopUpdateProvider.js";
import { isLocalEdition } from "./edition.js";

export default function App() {
  const workspaceRoutes = (
    <>
      <Route path="/" element={<Dashboard />} />
      <Route path="/applications" element={<ApplicationsLog />} />
      <Route path="/applications/archived" element={<ApplicationsLog archiveMode />} />
      <Route path="/applications/:id" element={<AppDetail />} />
      <Route path="/profile" element={<ProfileManager />} />
    </>
  );

  return (
    <DesktopUpdateProvider>
      <Routes>
        {isLocalEdition ? (
          // No sign-in, billing, or support routes: the local edition has no accounts or server.
          <Route element={<LocalLayout />}>
            {workspaceRoutes}
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        ) : (
          <>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route element={<AuthenticatedLayout />}>
              {workspaceRoutes}
              <Route path="/billing" element={<Billing />} />
              <Route path="/settings" element={<SettingsRoute />} />
              <Route path="/support" element={<Support />} />
            </Route>
          </>
        )}
      </Routes>
      <DesktopUpdateGate />
    </DesktopUpdateProvider>
  );
}

/** Creem checkouts configured before credits moved to /billing still return to /settings. */
function SettingsRoute() {
  const { search } = useLocation();
  if (new URLSearchParams(search).has("checkout")) {
    return <Navigate to={`/billing${search}`} replace />;
  }
  return <Settings />;
}
