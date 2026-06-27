import { Navigate } from "react-router-dom";
import { authClient } from "../api/auth";
import AppShell from "./AppShell";

export default function AuthenticatedLayout() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <AppShell />;
}
