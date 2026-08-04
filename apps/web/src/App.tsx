import { Route, Routes } from "react-router-dom";
import AuthenticatedLayout from "./components/AuthenticatedLayout";
import Dashboard from "./pages/Dashboard";
import ApplicationsLog from "./pages/ApplicationsLog";
import AppDetail from "./pages/AppDetail";
import ProfileManager from "./pages/ProfileManager";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import TemplateManager from "./pages/TemplateManager";
import Settings from "./pages/Settings";
import Support from "./pages/Support";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import { DesktopUpdateGate } from "./desktop-updates/DesktopUpdateGate.js";
import { DesktopUpdateProvider } from "./desktop-updates/DesktopUpdateProvider.js";

export default function App() {
  return (
    <DesktopUpdateProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route element={<AuthenticatedLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/applications" element={<ApplicationsLog />} />
          <Route path="/applications/archived" element={<ApplicationsLog archiveMode />} />
          <Route path="/applications/:id" element={<AppDetail />} />
          <Route path="/profile" element={<ProfileManager />} />
          <Route path="/templates" element={<TemplateManager />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/support" element={<Support />} />
        </Route>
      </Routes>
      <DesktopUpdateGate />
    </DesktopUpdateProvider>
  );
}
