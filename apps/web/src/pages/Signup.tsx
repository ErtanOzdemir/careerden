import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { authClient } from "../api/auth";
import { AuthInput, AuthShell } from "./Login";
import { Button } from "../components/ui/button.js";
import { ArrowRight, Eye } from "lucide-react";

export default function Signup() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isPending && session) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const result = await authClient.signUp.email({ email, password, name });

    setIsSubmitting(false);

    if (result.error) {
      setError(result.error.message ?? "Could not create account.");
      return;
    }

    navigate("/", { replace: true });
  }

  return (
    <AuthShell title="Create Account" subtitle="Start your Link2CV workspace.">
      <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
        <AuthInput
          label="Name"
          onChange={setName}
          type="text"
          value={name}
          placeholder="Enter your name..."
        />
        <AuthInput
          label="Email address"
          onChange={setEmail}
          type="email"
          value={email}
          placeholder="workmail@gmail.com"
        />
        <AuthInput
          label="Password"
          onChange={setPassword}
          type="password"
          value={password}
          placeholder="Create a password"
          trailing={<Eye className="size-4 text-muted-foreground" aria-hidden="true" />}
        />
        {error && (
          <div className="rounded-lg border border-destructive/20 bg-danger-soft px-4 py-2.5 text-sm text-destructive">
            {error}
          </div>
        )}
        <Button
          className="mt-2 w-full rounded-lg bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
          size="lg"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Creating..." : "Create account"}
          <ArrowRight className="size-4" />
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link className="font-medium text-primary hover:underline" to="/login">
          Login
        </Link>
      </p>
    </AuthShell>
  );
}
