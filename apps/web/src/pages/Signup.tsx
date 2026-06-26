import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { authClient } from "../api/auth";
import { AuthInput, AuthShell } from "./Login";

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

    const result = await authClient.signUp.email({
      email,
      password,
      name,
    });

    setIsSubmitting(false);

    if (result.error) {
      setError(result.error.message ?? "Could not create account.");
      return;
    }

    navigate("/", { replace: true });
  }

  return (
    <AuthShell
      subtitle="Create the account used for profiles, applications, templates, and generated documents."
      title="Create your Link2CV account"
    >
      <form className="space-y-md" onSubmit={(event) => void handleSubmit(event)}>
        <AuthInput label="Full name" onChange={setName} type="text" value={name} />
        <AuthInput label="Email" onChange={setEmail} type="email" value={email} />
        <AuthInput label="Password" onChange={setPassword} type="password" value={password} />
        {error && <p className="text-body-sm text-error">{error}</p>}
        <button
          className="h-12 w-full rounded-lg bg-primary px-4 text-label-lg font-bold text-on-primary transition hover:bg-primary/90 disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Creating..." : "Create account"}
        </button>
      </form>
      <p className="mt-md text-center text-body-sm text-secondary">
        Already have an account?{" "}
        <Link className="font-bold text-primary hover:underline" to="/login">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
