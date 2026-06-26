import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { authClient } from "../api/auth";

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

    const result = await authClient.signIn.email({
      email,
      password,
    });

    setIsSubmitting(false);

    if (result.error) {
      setError(result.error.message ?? "Could not sign in.");
      return;
    }

    navigate("/", { replace: true });
  }

  return (
    <AuthShell
      subtitle="Access your profile, application workspace, templates, and generated documents."
      title="Sign in to Link2CV"
    >
      <form className="space-y-md" onSubmit={(event) => void handleSubmit(event)}>
        <AuthInput label="Email" onChange={setEmail} type="email" value={email} />
        <AuthInput label="Password" onChange={setPassword} type="password" value={password} />
        {error && <p className="text-body-sm text-error">{error}</p>}
        <button
          className="h-12 w-full rounded-lg bg-primary px-4 text-label-lg font-bold text-on-primary transition hover:bg-primary/90 disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <p className="mt-md text-center text-body-sm text-secondary">
        No account?{" "}
        <Link className="font-bold text-primary hover:underline" to="/signup">
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
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center">
        <div className="grid overflow-hidden rounded-lg border border-outline-variant bg-surface shadow-sm lg:min-h-[560px] lg:grid-cols-[0.92fr_1.08fr]">
          <aside className="hidden border-r border-outline-variant bg-surface-container-low px-10 py-12 lg:flex lg:flex-col lg:justify-between">
            <div>
              <div className="mb-xl flex items-center gap-3">
                <span className="material-symbols-rounded grid size-11 place-items-center rounded-lg bg-primary text-on-primary">
                  work_history
                </span>
                <div>
                  <p className="font-display text-title-lg font-bold text-on-surface">Link2CV</p>
                  <p className="text-body-sm text-secondary">Desktop application workspace</p>
                </div>
              </div>
              <h2 className="max-w-sm font-display text-display-sm font-bold text-on-surface">
                Keep every application step tied to the same account.
              </h2>
            </div>
            <div className="space-y-md text-body-md text-secondary">
              <p className="flex items-center gap-3">
                <span className="material-symbols-rounded text-primary">account_circle</span>
                Profiles and notes stay connected to your user account.
              </p>
              <p className="flex items-center gap-3">
                <span className="material-symbols-rounded text-primary">description</span>
                Templates, mappings, and generated files are available after sign in.
              </p>
              <p className="flex items-center gap-3">
                <span className="material-symbols-rounded text-primary">sync_alt</span>
                Desktop scraping can send completed job data to the API workspace.
              </p>
            </div>
          </aside>
          <div className="flex items-center justify-center px-5 py-8 sm:px-8 sm:py-10 lg:px-14">
            <div className="w-full max-w-[460px]">
              <div className="mb-lg flex items-center gap-3 lg:hidden">
                <span className="material-symbols-rounded grid size-10 place-items-center rounded-lg bg-primary text-on-primary">
                  work_history
                </span>
                <div>
                  <p className="font-display text-title-lg font-bold text-on-surface">Link2CV</p>
                  <p className="text-body-sm text-secondary">Desktop application workspace</p>
                </div>
              </div>
              <div className="mb-lg">
                <h1 className="font-display text-headline-lg font-bold text-on-surface">{title}</h1>
                <p className="mt-2 text-body-md text-secondary">{subtitle}</p>
              </div>
              {children}
            </div>
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
}: {
  label: string;
  onChange: (value: string) => void;
  type: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-label-md font-bold text-secondary">{label}</span>
      <input
        className="h-12 w-full rounded-lg border border-outline-variant bg-surface px-4 text-body-md outline-none transition focus:border-primary"
        onChange={(event) => onChange(event.target.value)}
        required
        type={type}
        value={value}
      />
    </label>
  );
}

export { AuthShell };
