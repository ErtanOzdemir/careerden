import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { authClient } from "../api/auth";
import { cn } from "../lib/utils.js";
import { Button } from "../components/ui/button.js";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Eye,
  EyeOff,
  Link2,
  RotateCw,
  Sparkles,
} from "lucide-react";
import { BrandLogo } from "../components/BrandLogo.js";

type LoginStep = "credentials" | "otp";

export default function Login() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();
  const [step, setStep] = useState<LoginStep>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  if (!isPending && session) {
    return <Navigate to="/" replace />;
  }

  async function handleCredentialsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const result = await authClient.signIn.email({ email, password });

    setIsSubmitting(false);

    if (result.error) {
      if (isEmailNotVerifiedError(result.error)) {
        setStep("otp");
        return;
      }

      setError(result.error.message ?? "Could not sign in.");
      return;
    }

    navigate("/", { replace: true });
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

  function handleBackToCredentials() {
    setStep("credentials");
    setOtp("");
    setError(null);
  }

  function togglePasswordVisibility() {
    setIsPasswordVisible((value) => !value);
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
            onClick={handleBackToCredentials}
          >
            <ArrowLeft className="size-4" />
          </Button>
        ) : undefined
      }
      title={step === "credentials" ? "Get Started Now" : "Verify Email"}
      subtitle={
        step === "credentials"
          ? "Sign in to your Link2CV workspace."
          : `Enter the code sent to ${email}.`
      }
    >
      {step === "credentials" ? (
        <form className="space-y-4" onSubmit={(event) => void handleCredentialsSubmit(event)}>
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
            type={isPasswordVisible ? "text" : "password"}
            value={password}
            placeholder="Enter your password"
            trailing={
              <Button
                aria-label={isPasswordVisible ? "Hide password" : "Show password"}
                className="size-8 rounded-full"
                size="icon"
                type="button"
                variant="ghost"
                onClick={togglePasswordVisibility}
              >
                {isPasswordVisible ? (
                  <EyeOff className="size-4 text-muted-foreground" aria-hidden="true" />
                ) : (
                  <Eye className="size-4 text-muted-foreground" aria-hidden="true" />
                )}
              </Button>
            }
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
            {isSubmitting ? "Signing in..." : "Log in"}
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
            className="w-full rounded-lg bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
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
      {step === "credentials" && (
        <p className="mt-5 text-center text-sm text-muted-foreground">
          No account?{" "}
          <Link className="font-medium text-primary hover:underline" to="/signup">
            Signup
          </Link>
        </p>
      )}
    </AuthShell>
  );
}

function isEmailNotVerifiedError(error: { code?: string; message?: string }) {
  return error.code === "EMAIL_NOT_VERIFIED" || error.message === "Email not verified";
}

export function AuthShell({
  children,
  headerAction,
  subtitle,
  title,
}: {
  children: ReactNode;
  headerAction?: ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <main
      data-testid="auth-page-shell"
      className="flex min-h-screen bg-sidebar p-2 text-foreground [-webkit-app-region:drag] sm:p-3"
    >
      <section
        data-testid="auth-card-shell"
        className="grid min-h-[calc(100vh-1rem)] w-full max-w-none overflow-hidden rounded-none bg-sidebar shadow-none sm:min-h-[calc(100vh-1.5rem)] md:grid-cols-[1.08fr_1fr]"
      >
        <div
          data-testid="auth-wave-panel"
          className="auth-wave-panel relative hidden overflow-hidden bg-black px-8 pt-0 pb-8 text-white dark:bg-white dark:text-black md:mt-10 md:block md:min-h-[calc(100vh-4rem)] md:rounded-l-2xl md:rounded-r-2xl md:rounded-tl-2xl"
        >
          <div className="relative z-10 flex h-full flex-col">
            <div
              data-testid="auth-wave-brand"
              className="flex h-24 items-center gap-2 pb-4 text-sm text-white/70 dark:text-black/65"
            >
              <BrandLogo variant="inverse" className="size-9 rounded-lg object-contain" />
              Link2CV
            </div>
            <div className="mt-12 max-w-sm">
              <p className="text-sm text-white/65 dark:text-black/60">You can easily</p>
              <h2 className="mt-3 text-4xl font-semibold leading-tight text-white dark:text-black">
                Speed up your work with smart CV tools
              </h2>
            </div>
            <div className="mt-auto">
              <p className="text-center text-xs text-white/45 dark:text-black/45">Your workspace</p>
              <div className="mt-5 grid grid-cols-3 gap-3 text-xs font-medium text-white/55 dark:text-black/55">
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
                <BrandLogo className="size-9 rounded-lg object-contain" />
                Link2CV
              </div>
            </div>
            <div className="mb-7">
              {headerAction}
              <h1 className="text-3xl font-semibold tracking-normal text-foreground dark:text-white">
                {title}
              </h1>
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
  const inputClass =
    "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/20";

  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-foreground">{label}</span>
      <span className="relative block">
        <input
          className={cn(inputClass, trailing ? "pr-12" : undefined)}
          onChange={(event) => onChange(event.target.value)}
          required
          type={type}
          value={value}
          placeholder={placeholder}
        />
        {trailing && (
          <span className="absolute inset-y-0 right-3 flex items-center">{trailing}</span>
        )}
      </span>
    </label>
  );
}
