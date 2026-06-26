import { Route, Routes } from "react-router-dom";
import AuthenticatedLayout from "./components/AuthenticatedLayout";
import Dashboard from "./pages/Dashboard";
import ApplicationsLog from "./pages/ApplicationsLog";
import AppDetail from "./pages/AppDetail";
import ProfileManager from "./pages/ProfileManager";
import Login from "./pages/Login";
import Signup from "./pages/Signup";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route element={<AuthenticatedLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/applications" element={<ApplicationsLog />} />
        <Route path="/applications/:id" element={<AppDetail />} />
        <Route path="/profile" element={<ProfileManager />} />
      </Route>
    </Routes>
  );
}
