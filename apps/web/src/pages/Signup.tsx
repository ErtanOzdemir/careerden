import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { authClient } from "../api/auth";
import { AuthInput } from "./Login";
import { Button } from "../components/ui/button.js";
import { ArrowRight } from "lucide-react";

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
    <SignupShell
      title="Create your Link2CV account"
      subtitle="Set up the account used for profiles, applications, and generated documents."
    >
      <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
        <AuthInput
          label="Full name"
          onChange={setName}
          type="text"
          value={name}
          placeholder="Ada Lovelace"
        />
        <AuthInput
          label="Email"
          onChange={setEmail}
          type="email"
          value={email}
          placeholder="you@example.com"
        />
        <AuthInput
          label="Password"
          onChange={setPassword}
          type="password"
          value={password}
          placeholder="At least 8 characters"
        />
        {error && (
          <div className="rounded-lg border border-destructive/20 bg-danger-soft px-4 py-2.5 text-sm text-destructive">
            {error}
          </div>
        )}
        <Button className="w-full" size="lg" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create account"}
          <ArrowRight className="size-4" />
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link className="font-medium text-primary hover:underline" to="/login">
          Sign in
        </Link>
      </p>
    </SignupShell>
  );
}

function SignupShell({
  children,
  subtitle,
  title,
}: {
  children: React.ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <svg viewBox="0 0 24 24" fill="currentColor" className="size-5">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
          </div>
          <p className="mt-4 text-lg font-semibold text-foreground">Link2CV</p>
          <p className="text-sm text-muted-foreground">Career workspace</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-6">
            <h1 className="text-lg font-semibold text-foreground">{title}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}
