import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowLeft, ArrowRight, CircleCheck, Eye, EyeOff } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { authClient } from "../api/auth.js";
import { Button, buttonVariants } from "../components/ui/button.js";
import { AuthInput, AuthShell } from "./Login.js";

const minimumPasswordLength = 8;
const maximumPasswordLength = 128;

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const linkError = searchParams.get("error");
  const [newPassword, setNewPassword] = useState("");
  const [confirmedPassword, setConfirmedPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmationVisible, setIsConfirmationVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isInvalidLink = !token || Boolean(linkError);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!token) {
      return;
    }

    if (newPassword.length < minimumPasswordLength || newPassword.length > maximumPasswordLength) {
      setError("Password must be between 8 and 128 characters.");
      return;
    }

    if (newPassword !== confirmedPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    const result = await authClient.resetPassword({ newPassword, token });
    setIsSubmitting(false);

    if (result.error) {
      setError(result.error.message ?? "Could not reset your password.");
      return;
    }

    setNewPassword("");
    setConfirmedPassword("");
    setIsComplete(true);
  }

  if (isInvalidLink) {
    return (
      <AuthShell
        title="Reset Link Invalid"
        subtitle="This password-reset link is invalid or has expired."
      >
        <div className="space-y-4">
          <p
            role="alert"
            className="rounded-lg border border-destructive/20 bg-danger-soft px-4 py-3 text-sm text-destructive"
          >
            Request a new link to continue resetting your password.
          </p>
          <Link
            className={buttonVariants({ className: "w-full rounded-lg", size: "lg" })}
            to="/forgot-password"
          >
            Request a new link <ArrowRight className="size-4" />
          </Link>
          <p className="text-center text-sm text-muted-foreground">
            <Link className="font-medium text-primary hover:underline" to="/login">
              Back to login
            </Link>
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={isComplete ? "Password Updated" : "Reset Password"}
      subtitle={
        isComplete
          ? "Your password has been reset. Sign in with your new password."
          : "Choose a new password for your Link2CV account."
      }
    >
      {isComplete ? (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-lg border border-success/20 bg-success-soft px-4 py-3 text-sm text-foreground">
            <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
            <p>All existing sessions have been signed out for your security.</p>
          </div>
          <Link
            className={buttonVariants({ className: "w-full rounded-lg", size: "lg" })}
            to="/login"
          >
            Continue to login <ArrowRight className="size-4" />
          </Link>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <AuthInput
            autoComplete="new-password"
            label="New password"
            maxLength={maximumPasswordLength}
            minLength={minimumPasswordLength}
            onChange={setNewPassword}
            type={isPasswordVisible ? "text" : "password"}
            value={newPassword}
            placeholder="Enter a new password"
            trailing={
              <PasswordVisibilityButton
                isVisible={isPasswordVisible}
                label="new password"
                onClick={() => setIsPasswordVisible((value) => !value)}
              />
            }
          />
          <AuthInput
            autoComplete="new-password"
            label="Confirm new password"
            maxLength={maximumPasswordLength}
            minLength={minimumPasswordLength}
            onChange={setConfirmedPassword}
            type={isConfirmationVisible ? "text" : "password"}
            value={confirmedPassword}
            placeholder="Enter the password again"
            trailing={
              <PasswordVisibilityButton
                isVisible={isConfirmationVisible}
                label="password confirmation"
                onClick={() => setIsConfirmationVisible((value) => !value)}
              />
            }
          />
          <p className="text-xs text-muted-foreground">Use between 8 and 128 characters.</p>
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
            {isSubmitting ? "Resetting..." : "Reset password"}
            <ArrowRight className="size-4" />
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            <Link
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              to="/login"
            >
              <ArrowLeft className="size-3.5" /> Back to login
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}

function PasswordVisibilityButton({
  isVisible,
  label,
  onClick,
}: {
  isVisible: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      aria-label={`${isVisible ? "Hide" : "Show"} ${label}`}
      className="size-8 rounded-full"
      size="icon"
      type="button"
      variant="ghost"
      onClick={onClick}
    >
      {isVisible ? (
        <EyeOff className="size-4 text-muted-foreground" aria-hidden="true" />
      ) : (
        <Eye className="size-4 text-muted-foreground" aria-hidden="true" />
      )}
    </Button>
  );
}
