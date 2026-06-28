import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { authClient } from "../api/auth";
import { Button } from "../components/ui/button.js";
import { ArrowRight, BriefcaseBusiness, Eye, Link2, Sparkles } from "lucide-react";

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
    <AuthShell title="Get Started Now" subtitle="Sign in to your Link2CV workspace.">
      <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
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
          placeholder="Enter your password"
          trailing={<Eye className="size-4 text-muted-foreground" aria-hidden="true" />}
        />
        {error && (
          <div className="rounded-lg border border-destructive/20 bg-danger-soft px-4 py-2.5 text-sm text-destructive">
            {error}
          </div>
        )}
        <Button
          className="mt-2 w-full rounded-lg bg-black text-white hover:bg-black/90"
          size="lg"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Signing in..." : "Log in"}
          <ArrowRight className="size-4" />
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-muted-foreground">
        No account?{" "}
        <Link className="font-medium text-primary hover:underline" to="/signup">
          Signup
        </Link>
      </p>
    </AuthShell>
  );
}

export function AuthShell({
  children,
  subtitle,
  title,
}: {
  children: ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <main
      data-testid="auth-page-shell"
      className="flex min-h-screen bg-white p-2 text-foreground [-webkit-app-region:drag] sm:p-3"
    >
      <section
        data-testid="auth-card-shell"
        className="grid min-h-[calc(100vh-1rem)] w-full max-w-none overflow-hidden rounded-none bg-white shadow-none sm:min-h-[calc(100vh-1.5rem)] md:grid-cols-[1.08fr_1fr]"
      >
        <div
          data-testid="auth-wave-panel"
          className="auth-wave-panel relative hidden overflow-hidden bg-black px-8 pt-0 pb-8 text-white md:mt-10 md:block md:min-h-[calc(100vh-4rem)] md:rounded-tl-2xl md:rounded-r-2xl"
        >
          <div className="relative z-10 flex h-full flex-col">
            <div
              data-testid="auth-wave-brand"
              className="flex h-24 items-end gap-2 pb-4 text-sm text-white/70"
            >
              <span className="flex size-9 items-center justify-center rounded-lg border border-white/15 bg-white/10">
                <Link2 className="size-4" />
              </span>
              Link2CV
            </div>
            <div className="mt-12 max-w-sm">
              <p className="text-sm text-white/65">You can easily</p>
              <h2 className="mt-3 text-4xl font-semibold leading-tight text-white">
                Speed up your work with smart CV tools
              </h2>
            </div>
            <div className="mt-auto">
              <p className="text-center text-xs text-white/45">Your workspace</p>
              <div className="mt-5 grid grid-cols-3 gap-3 text-xs font-medium text-white/55">
                <span className="flex items-center gap-2">
                  <BriefcaseBusiness className="size-4" />
                  Applications
                </span>
                <span className="flex items-center justify-center gap-2">
                  <Sparkles className="size-4" />
                  Matching
                </span>
                <span className="flex items-center justify-end gap-2">
                  <Link2 className="size-4" />
                  Documents
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex min-h-[calc(100vh-1rem)] items-center justify-center px-6 py-10 sm:min-h-[calc(100vh-1.5rem)] sm:px-10">
          <div
            data-testid="auth-form-shell"
            className="w-full max-w-sm [-webkit-app-region:no-drag]"
          >
            <div className="mb-8 pt-10 md:hidden">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className="flex size-9 items-center justify-center rounded-lg bg-black text-white">
                  <Link2 className="size-4" />
                </span>
                Link2CV
              </div>
            </div>
            <div className="mb-7">
              <h1 className="text-3xl font-semibold tracking-normal text-foreground">{title}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
            </div>
            {children}
          </div>
        </div>
      </section>
    </main>
  );
}

export function AuthInput({
  label,
  onChange,
  type,
  value,
  placeholder,
  trailing,
}: {
  label: string;
  onChange: (value: string) => void;
  type: string;
  value: string;
  placeholder?: string;
  trailing?: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-foreground">{label}</span>
      <span className="relative block">
        <input
          className="h-11 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-black focus:ring-3 focus:ring-black/10"
          onChange={(event) => onChange(event.target.value)}
          required
          type={type}
          value={value}
          placeholder={placeholder}
        />
        {trailing && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
            {trailing}
          </span>
        )}
      </span>
    </label>
  );
}
