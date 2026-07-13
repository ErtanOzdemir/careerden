import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowLeft, ArrowRight, MailCheck } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { authClient } from "../api/auth.js";
import { Button, buttonVariants } from "../components/ui/button.js";
import { AuthInput, AuthShell } from "./Login.js";

export default function ForgotPassword() {
  const { data: session, isPending } = authClient.useSession();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isPending && session) {
    return <Navigate to="/settings" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const result = await authClient.requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setIsSubmitting(false);

    if (result.error) {
      setError(result.error.message ?? "Could not request a password reset.");
      return;
    }

    setIsComplete(true);
  }

  return (
    <AuthShell
      title={isComplete ? "Check Your Email" : "Forgot Password"}
      subtitle={
        isComplete
          ? "If an account exists for that address, a reset link is on its way."
          : "Enter your email address and we'll send you a reset link."
      }
    >
      {isComplete ? (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-lg border border-success/20 bg-success-soft px-4 py-3 text-sm text-foreground">
            <MailCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
            <p>Check your inbox and follow the link to choose a new password.</p>
          </div>
          <Link
            className={buttonVariants({
              className: "w-full rounded-lg",
              size: "lg",
              variant: "outline",
            })}
            to="/login"
          >
            <ArrowLeft className="size-4" /> Back to login
          </Link>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <AuthInput
            autoComplete="email"
            label="Email address"
            onChange={setEmail}
            type="email"
            value={email}
            placeholder="workmail@gmail.com"
          />
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/20 bg-danger-soft px-4 py-2.5 text-sm text-destructive"
            >
              {error}
            </div>
          )}
          <Button
            className="mt-2 w-full rounded-lg bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
            size="lg"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Sending..." : "Send reset link"}
            <ArrowRight className="size-4" />
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            <Link className="font-medium text-primary hover:underline" to="/login">
              Back to login
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
