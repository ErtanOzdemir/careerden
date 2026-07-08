import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { authClient } from "../api/auth";
import { AuthInput, AuthShell } from "./Login";
import { Button } from "../components/ui/button.js";
import { ArrowLeft, ArrowRight, Eye, RotateCw } from "lucide-react";

type SignupStep = "details" | "otp";

export default function Signup() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();
  const [step, setStep] = useState<SignupStep>("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  if (!isPending && session) {
    return <Navigate to="/" replace />;
  }

  async function handleDetailsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const result = await authClient.signUp.email({ email, password, name });

    setIsSubmitting(false);

    if (result.error) {
      setError(result.error.message ?? "Could not create account.");
      return;
    }

    setStep("otp");
  }

  async function handleOtpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const result = await authClient.emailOtp.verifyEmail({ email, otp });

    setIsSubmitting(false);

    if (result.error) {
      setError(result.error.message ?? "Could not verify code.");
      return;
    }

    navigate("/", { replace: true });
  }

  async function handleResendOtp() {
    setIsResending(true);
    setError(null);

    const result = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "email-verification",
    });

    setIsResending(false);

    if (result.error) {
      setError(result.error.message ?? "Could not send a new code.");
    }
  }

  function handleBackToDetails() {
    setStep("details");
    setOtp("");
    setError(null);
  }

  return (
    <AuthShell
      headerAction={
        step === "otp" ? (
          <Button
            aria-label="Change email"
            className="mb-4 rounded-full"
            size="icon"
            type="button"
            variant="ghost"
            onClick={handleBackToDetails}
          >
            <ArrowLeft className="size-4" />
          </Button>
        ) : undefined
      }
      title={step === "details" ? "Create Account" : "Verify Email"}
      subtitle={
        step === "details" ? "Start your Link2CV workspace." : `Enter the code sent to ${email}.`
      }
    >
      {step === "details" ? (
        <form className="space-y-4" onSubmit={(event) => void handleDetailsSubmit(event)}>
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
      ) : (
        <form className="space-y-4" onSubmit={(event) => void handleOtpSubmit(event)}>
          <AuthInput
            label="Verification code"
            onChange={setOtp}
            type="text"
            value={otp}
            placeholder="123456"
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
            {isSubmitting ? "Verifying..." : "Verify email"}
            <ArrowRight className="size-4" />
          </Button>
          <Button
            className="w-full rounded-lg"
            size="lg"
            type="button"
            variant="outline"
            disabled={isResending}
            onClick={() => void handleResendOtp()}
          >
            <RotateCw className="size-4" />
            {isResending ? "Sending..." : "Send new code"}
          </Button>
        </form>
      )}
      {step === "details" && (
        <p className="mt-5 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link className="font-medium text-primary hover:underline" to="/login">
            Login
          </Link>
        </p>
      )}
    </AuthShell>
  );
}
