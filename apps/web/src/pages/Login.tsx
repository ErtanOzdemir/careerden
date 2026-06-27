import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { authClient } from "../api/auth";
import { Button } from "../components/ui/button.js";
import { Link2, ArrowRight } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();
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

    const result = await authClient.signIn.email({ email, password });

    setIsSubmitting(false);

    if (result.error) {
      setError(result.error.message ?? "Could not sign in.");
      return;
    }

    navigate("/", { replace: true });
  }

  return (
    <AuthShell
      title="Sign in to Link2CV"
      subtitle="Access your profile, applications, and generated documents."
    >
      <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
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
          placeholder="Your password"
        />
        {error && (
          <div className="rounded-lg border border-destructive/20 bg-danger-soft px-4 py-2.5 text-sm text-destructive">
            {error}
          </div>
        )}
        <Button className="w-full" size="lg" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Sign in"}
          <ArrowRight className="size-4" />
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        No account?{" "}
        <Link className="font-medium text-primary hover:underline" to="/signup">
          Create one
        </Link>
      </p>
    </AuthShell>
  );
}

function AuthShell({
  children,
  subtitle,
  title,
}: {
  children: ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Link2 className="size-5" />
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

export function AuthInput({
  label,
  onChange,
  type,
  value,
  placeholder,
}: {
  label: string;
  onChange: (value: string) => void;
  type: string;
  value: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">{label}</span>
      <input
        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/20"
        onChange={(event) => onChange(event.target.value)}
        required
        type={type}
        value={value}
        placeholder={placeholder}
      />
    </label>
  );
}
